import * as React from 'react'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { MultiSelect } from '@/components/form/MultiSelect'
import { LinkDialog } from '@/components/team/LinkDialog'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { useCreateTeamMemberMutation } from '@/api/team'
import { useRolesQuery } from '@/api/roles'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email').max(320),
  phone: z.string().trim().max(30).optional(),
  roleIds: z.array(z.string()),
})
type Values = z.infer<typeof schema>

const emptyValues: Values = { name: '', email: '', phone: '', roleIds: [] }

function MemberCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateTeamMemberMutation()
  const roles = useRolesQuery()
  const [inviteLink, setInviteLink] = React.useState<string | undefined>()
  const [invitedName, setInvitedName] = React.useState('')

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues })

  React.useEffect(() => {
    if (open) {
      form.reset(emptyValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function onSubmit(values: Values) {
    create
      .mutateAsync({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        roleIds: values.roleIds,
      })
      .then((result) => {
        toast.success('Invite created')
        setInvitedName(result.member?.name ?? values.email)
        setInviteLink(result.inviteLink)
        onOpenChange(false)
      })
      .catch((error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New team member</DialogTitle>
            <DialogDescription>
              No password is set here. The person is created as <strong>Invited</strong> and gets an
              invite link to choose their own password — you never see or set their credentials.
            </DialogDescription>
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
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roles</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={(roles.data ?? []).map((r) => ({ value: r.id!, label: r.name! }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select one or more roles…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Send invite
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <LinkDialog
        open={inviteLink !== undefined}
        onOpenChange={(next) => {
          if (!next) {
            setInviteLink(undefined)
          }
        }}
        title="Invite link"
        link={inviteLink}
        description={
          <>
            <p>
              <strong>{invitedName}</strong> is now <strong>Invited</strong>, with no password.
              Email is not wired yet, so hand them this link — they open it to choose their own
              password.
            </p>
          </>
        }
      />
    </>
  )
}

export { MemberCreateDialog }
