import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { slugify } from '@/lib/slug'
import {
  ALLOWED_UNITS,
  type AllowedUnit,
  applyKindConstraint,
  isKindConstraintLocked,
  unitApplies,
} from '@/lib/attribute-rules'
import {
  useAttributeGroupsQuery,
  useCreateAttributeMutation,
  useUpdateAttributeMutation,
  type Attribute,
} from '@/api/attributes'

const NONE = '__none__'

const KIND_OPTIONS = ['OPTION', 'SPEC'] as const
const DATA_TYPE_OPTIONS = ['TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT'] as const
const APPLIES_TO_OPTIONS = ['PRODUCT', 'VARIANT'] as const

const attributeFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(100),
  name: z.string().trim().min(1, 'Name is required').max(200),
  kind: z.enum(KIND_OPTIONS),
  dataType: z.enum(DATA_TYPE_OPTIONS),
  appliesTo: z.enum(APPLIES_TO_OPTIONS),
  unit: z.string().optional(),
  groupId: z.string().optional(),
  helpText: z.string().optional(),
})
type AttributeFormValues = z.infer<typeof attributeFormSchema>

const emptyValues: AttributeFormValues = {
  code: '',
  name: '',
  kind: 'SPEC',
  dataType: 'TEXT',
  appliesTo: 'PRODUCT',
  unit: '',
  groupId: NONE,
  helpText: '',
}

export interface AttributeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a new attribute; supply the currently-loaded row to edit it. */
  attribute?: Attribute
}

/**
 * `code`, `kind` and `data_type` are permanently immutable after creation (D4.10). On create
 * this warns inline under each field; on edit those three render read-only with the reason
 * visible, and are sent back unchanged in the update payload — the server rejects a mismatch
 * explicitly rather than silently ignoring it (D2.11).
 */
function AttributeFormDialog({ open, onOpenChange, attribute }: AttributeFormDialogProps) {
  const isEdit = !!attribute
  const groupsQuery = useAttributeGroupsQuery()
  const createAttribute = useCreateAttributeMutation()
  const updateAttribute = useUpdateAttributeMutation(attribute?.id ?? '')
  const pending = createAttribute.isPending || updateAttribute.isPending

  const codeEditedRef = React.useRef(isEdit)

  const form = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeFormSchema),
    defaultValues: emptyValues,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    codeEditedRef.current = isEdit
    form.reset(
      attribute
        ? {
            code: attribute.code ?? '',
            name: attribute.name ?? '',
            kind: attribute.kind ?? 'SPEC',
            dataType: attribute.dataType ?? 'TEXT',
            appliesTo: attribute.appliesTo ?? 'PRODUCT',
            unit: attribute.unit ?? '',
            groupId: attribute.groupId ?? NONE,
            helpText: attribute.helpText ?? '',
          }
        : emptyValues
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attribute])

  const kind = form.watch('kind')
  const dataType = form.watch('dataType')
  const locked = isKindConstraintLocked(kind)

  function onKindChange(value: string) {
    const nextKind = value as AttributeFormValues['kind']
    form.setValue('kind', nextKind)
    const constrained = applyKindConstraint(nextKind, {
      dataType: form.getValues('dataType'),
      appliesTo: form.getValues('appliesTo'),
    })
    form.setValue('dataType', constrained.dataType, { shouldValidate: true })
    form.setValue('appliesTo', constrained.appliesTo, { shouldValidate: true })
    if (constrained.dataType !== 'NUMBER') {
      form.setValue('unit', '')
    }
  }

  function onDataTypeChange(value: string) {
    form.setValue('dataType', value as AttributeFormValues['dataType'], { shouldValidate: true })
    if (value !== 'NUMBER') {
      form.setValue('unit', '')
    }
  }

  function onSubmit(values: AttributeFormValues) {
    const groupId = values.groupId === NONE ? undefined : values.groupId
    const shared = {
      name: values.name,
      groupId,
      helpText: values.helpText || undefined,
      // The unit <Select> only offers the contract's enum, so this narrowing is safe.
      unit: unitApplies(values.dataType)
        ? ((values.unit || undefined) as AllowedUnit | undefined)
        : undefined,
    }

    const mutation = isEdit
      ? updateAttribute.mutateAsync({
          ...shared,
          // D2.11 — code/kind/dataType/appliesTo are immutable after creation (D4.10) but
          // required in the update payload; sent back exactly as loaded, never re-derived
          // from form state the operator could not have changed anyway.
          code: attribute!.code!,
          kind: attribute!.kind!,
          dataType: attribute!.dataType!,
          appliesTo: attribute!.appliesTo!,
          // D2.24 — version is required and compared before any field is applied.
          version: attribute!.version!,
        })
      : createAttribute.mutateAsync({
          ...shared,
          code: values.code || undefined,
          kind: values.kind,
          dataType: values.dataType,
          appliesTo: values.appliesTo,
        })

    mutation
      .then(() => {
        toast.success(isEdit ? 'Attribute updated' : 'Attribute created')
        onOpenChange(false)
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit attribute' : 'New attribute'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        if (!isEdit && !codeEditedRef.current) {
                          form.setValue('code', slugify(event.target.value).replace(/-/g, '_'), {
                            shouldValidate: true,
                          })
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  {isEdit ? (
                    <>
                      <FormControl>
                        <Input value={field.value} disabled readOnly />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Cannot be changed after creation — the code identifies this attribute
                        everywhere it is used.
                      </p>
                    </>
                  ) : (
                    <>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(event) => {
                            codeEditedRef.current = true
                            field.onChange(event)
                          }}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Cannot be changed later.</p>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  {isEdit ? (
                    <>
                      <FormControl>
                        <Input value={field.value} disabled readOnly />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Cannot be changed after creation — promoting a SPEC to an OPTION would
                        retroactively turn descriptive data into a variant axis (D4.10).
                      </p>
                    </>
                  ) : (
                    <>
                      <Select value={field.value} onValueChange={onKindChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {KIND_OPTIONS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Cannot be changed later. OPTION always defines variants — choosing it forces
                        data type to single-select and applies-to to variant, below.
                      </p>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data type</FormLabel>
                  {isEdit ? (
                    <>
                      <FormControl>
                        <Input value={field.value} disabled readOnly />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Cannot be changed after creation.
                      </p>
                    </>
                  ) : (
                    <>
                      <Select
                        value={field.value}
                        onValueChange={onDataTypeChange}
                        disabled={locked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DATA_TYPE_OPTIONS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {locked
                          ? 'Locked to SINGLE_SELECT because kind is OPTION.'
                          : 'Cannot be changed later.'}
                      </p>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && unitApplies(dataType) && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value || NONE} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No unit</SelectItem>
                        {ALLOWED_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {isEdit && unitApplies(attribute!.dataType!) && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value || NONE} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No unit</SelectItem>
                        {ALLOWED_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="appliesTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applies to</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      form.setValue('appliesTo', value as AttributeFormValues['appliesTo'], {
                        shouldValidate: true,
                      })
                    }
                    disabled={locked}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {APPLIES_TO_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {locked && (
                    <p className="text-sm text-muted-foreground">
                      Locked to VARIANT because kind is OPTION — an option always defines a variant
                      axis.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No group</SelectItem>
                      {(groupsQuery.data ?? []).map((group) => (
                        <SelectItem key={group.id} value={group.id!}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="helpText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Help text</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { AttributeFormDialog }
