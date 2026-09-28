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
import {
  useCreateAttributeGroupMutation,
  useUpdateAttributeGroupMutation,
  type AttributeGroup,
} from '@/api/attributes'

const groupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
})
type GroupFormValues = z.infer<typeof groupFormSchema>

export interface AttributeGroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Omit to create a new group; supply the currently-loaded row to edit it. */
  group?: AttributeGroup
}

/** Minimal CRUD (spec §3) — no behaviour attaches to a group beyond its name and ordering. */
function AttributeGroupFormDialog({ open, onOpenChange, group }: AttributeGroupFormDialogProps) {
  const isEdit = !!group
  const createGroup = useCreateAttributeGroupMutation()
  const updateGroup = useUpdateAttributeGroupMutation(group?.id ?? '')
  const pending = createGroup.isPending || updateGroup.isPending

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '' },
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    form.reset({ name: group?.name ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group])

  function onSubmit(values: GroupFormValues) {
    const mutation = isEdit
      ? updateGroup.mutateAsync({ name: values.name, version: group!.version! })
      : createGroup.mutateAsync({ name: values.name })

    mutation
      .then(() => {
        toast.success(isEdit ? 'Group updated' : 'Group created')
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
          <DialogTitle>{isEdit ? 'Edit group' : 'New group'}</DialogTitle>
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

export { AttributeGroupFormDialog }
