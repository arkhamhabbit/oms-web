import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useCreatePricingVersionMutation, usePricingVersionsQuery } from '@/api/pricing'

const EFFECTIVE_NOW = 'EFFECTIVE_NOW'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  notes: z.string().max(2000).optional(),
  basedOnVersionId: z.string(),
})
type Values = z.infer<typeof schema>

function PricingVersionCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New pricing draft</DialogTitle>
          <DialogDescription>
            A draft starts as a copy of another version&apos;s prices, so a change is a few edits
            rather than re-entering every price. It governs nothing until it is published.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts from an empty form. */}
        {open && <CreateForm onOpenChange={onOpenChange} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const create = useCreatePricingVersionMutation()
  // Published versions are the useful starting points; a draft can be copied too.
  const versions = usePricingVersionsQuery({ page: 0, size: 50 })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', notes: '', basedOnVersionId: EFFECTIVE_NOW },
  })

  function onSubmit(values: Values) {
    create
      .mutateAsync({
        name: values.name,
        notes: values.notes || undefined,
        basedOnVersionId:
          values.basedOnVersionId === EFFECTIVE_NOW ? undefined : values.basedOnVersionId,
      })
      .then((version) => {
        toast.success('Draft created')
        onOpenChange(false)
        onCreated(version.id!)
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Diwali member pricing" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="basedOnVersionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start from</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={EFFECTIVE_NOW}>The version in effect now (usual)</SelectItem>
                  {(versions.data?.content ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id!}>
                      {v.name} — {v.state?.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A price the catalog has since undercut is not copied — it would resolve to the base
                selling price anyway.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>
            Create draft
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export { PricingVersionCreateDialog }
