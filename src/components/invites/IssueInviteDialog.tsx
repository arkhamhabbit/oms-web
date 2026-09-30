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
import { InviteLinkPanel } from '@/components/invites/InviteLinkPanel'
import { InviteRefusal } from '@/components/invites/InviteRefusal'
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { useInviteFromWaitlistMutation, useIssueInviteMutation, type Invite } from '@/api/invites'

const schema = z.object({
  mobile: z.string().trim().max(20),
  name: z.string().trim().max(200),
})
type Values = z.infer<typeof schema>

/**
 * Issues an admin invite — to a typed number, or (with `waitlistEntry`) to a waitlisted one,
 * which is exactly the same invite with the entry stamped invited. On success the dialog turns
 * into the link to share; a refusal (already an Insider, already invited) stays as a sentence.
 */
function IssueInviteDialog({
  open,
  onOpenChange,
  waitlistEntry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  waitlistEntry?: { id: string; mobile: string }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each open starts from an empty form. */}
        {open && <IssueForm onOpenChange={onOpenChange} waitlistEntry={waitlistEntry} />}
      </DialogContent>
    </Dialog>
  )
}

function IssueForm({
  onOpenChange,
  waitlistEntry,
}: {
  onOpenChange: (open: boolean) => void
  waitlistEntry?: { id: string; mobile: string }
}) {
  const issue = useIssueInviteMutation()
  const fromWaitlist = useInviteFromWaitlistMutation()
  const form = useForm<Values>({
    resolver: zodResolver(
      waitlistEntry
        ? schema
        : schema.extend({ mobile: z.string().trim().min(1, 'Mobile is required').max(20) })
    ),
    defaultValues: { mobile: waitlistEntry?.mobile ?? '', name: '' },
  })
  const [refusal, setRefusal] = React.useState<unknown>()
  const [issued, setIssued] = React.useState<Invite | undefined>()

  function onSubmit(values: Values) {
    setRefusal(undefined)
    const name = values.name || undefined
    const request = waitlistEntry
      ? fromWaitlist.mutateAsync({ entryId: waitlistEntry.id, name })
      : issue.mutateAsync({ mobile: values.mobile, name })
    request
      .then((invite) => {
        toast.success('Invite issued')
        setIssued(invite)
      })
      .catch((error) => {
        if (error instanceof ApiClientError && error.fieldErrors.length > 0) {
          applyApiErrorToForm(error, form)
        } else {
          setRefusal(error)
        }
      })
  }

  if (issued) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invite issued to {issued.mobile}</DialogTitle>
          <DialogDescription>
            Valid for seven days. The number&apos;s account is ready to claim from this link.
          </DialogDescription>
        </DialogHeader>
        <InviteLinkPanel invite={issued} />
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{waitlistEntry ? 'Invite from the waitlist' : 'Issue an invite'}</DialogTitle>
        <DialogDescription>
          An admin invite is valid for seven days and does not count against any tier&apos;s invite
          limit. OMS sends nothing — you get a join link and a message to share.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {refusal !== undefined && (
            <InviteRefusal error={refusal} onNavigate={() => onOpenChange(false)} />
          )}
          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile</FormLabel>
                <FormControl>
                  <Input
                    placeholder="98765 43210"
                    inputMode="tel"
                    readOnly={!!waitlistEntry}
                    {...field}
                  />
                </FormControl>
                {!waitlistEntry && (
                  <p className="text-xs text-muted-foreground">
                    Indian mobile. Any format works — it is stored as +91 and ten digits.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Stored on the account only if this invite creates it.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={issue.isPending || fromWaitlist.isPending}>
              Issue invite
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}

export { IssueInviteDialog }
