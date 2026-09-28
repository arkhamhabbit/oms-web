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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { useAddValueMutation, useUpdateValueMutation, type AttributeValue } from '@/api/attributes'

const valueFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(100),
  label: z.string().trim().min(1, 'Label is required').max(200),
})
type ValueFormValues = z.infer<typeof valueFormSchema>

export interface AttributeValueFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attributeId: string
  /** Omit to add a new value; supply the currently-loaded row to edit its label. */
  value?: AttributeValue
}

/** `code` is immutable, same treatment as the attribute-level fields — read-only with the reason
 * visible on edit, a plain warning on create. Only `label` can change after creation. */
function AttributeValueFormDialog({
  open,
  onOpenChange,
  attributeId,
  value,
}: AttributeValueFormDialogProps) {
  const isEdit = !!value
  const addValue = useAddValueMutation(attributeId)
  const updateValue = useUpdateValueMutation(attributeId, value?.id ?? '')
  const pending = addValue.isPending || updateValue.isPending

  const form = useForm<ValueFormValues>({
    resolver: zodResolver(valueFormSchema),
    defaultValues: { code: '', label: '' },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    form.reset(
      value ? { code: value.code ?? '', label: value.label ?? '' } : { code: '', label: '' }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value])

  function onSubmit(values: ValueFormValues) {
    const mutation = isEdit
      ? updateValue.mutateAsync({
          label: values.label,
          // D2.11 — code is immutable but required in the payload; sent back unchanged.
          code: value!.code!,
          // D2.24 — version is required and compared before any field is applied.
          version: value!.version!,
        })
      : addValue.mutateAsync({ code: values.code, label: values.label })

    mutation
      .then(() => {
        toast.success(isEdit ? 'Value updated' : 'Value added')
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit value' : 'New value'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                        Cannot be changed after creation — the code identifies this value everywhere
                        it is referenced.
                      </p>
                    </>
                  ) : (
                    <>
                      <FormControl>
                        <Input {...field} />
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
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {isEdit ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { AttributeValueFormDialog }
