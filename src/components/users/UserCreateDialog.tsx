import * as React from 'react'
import { Link } from 'react-router-dom'
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
import { ApiClientError, applyApiErrorToForm } from '@/lib/api-error'
import { useCreateUserMutation } from '@/api/users'

const schema = z.object({
  mobile: z.string().trim().min(1, 'Mobile is required').max(20),
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(320)]),
})
type Values = z.infer<typeof schema>

const emptyValues: Values = { mobile: '', name: '', email: '' }

function UserCreateDialog({
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
          <DialogTitle>Invite a customer</DialogTitle>
          <DialogDescription>
            This starts an <strong>Invited</strong> account holding the Consumer role — never an
            active user, and no password is set here. The person becomes Active only when they claim
            the account themselves.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts from an empty form. */}
        <CreateForm onOpenChange={onOpenChange} onCreated={onCreated} />
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
  const create = useCreateUserMutation()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyValues })
  // A duplicate is a sentence with a way to the account that already has the number.
  const [duplicate, setDuplicate] = React.useState<
    { message: string; search: string } | undefined
  >()

  function onSubmit(values: Values) {
    setDuplicate(undefined)
    create
      .mutateAsync({
        mobile: values.mobile,
        name: values.name,
        email: values.email || undefined,
      })
      .then((user) => {
        toast.success('Account created as Invited')
        onOpenChange(false)
        onCreated(user.id!)
      })
      .catch((error) => {
        if (error instanceof ApiClientError && error.code === 'CONFLICT') {
          const usedEmail = values.email !== '' && error.message.toLowerCase().includes('email')
          setDuplicate({ message: error.message, search: usedEmail ? values.email : values.mobile })
        } else if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {duplicate && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            {duplicate.message}{' '}
            <Link
              to={`/users?search=${encodeURIComponent(duplicate.search)}`}
              className="font-medium underline underline-offset-2"
              onClick={() => onOpenChange(false)}
            >
              Find the existing account
            </Link>
            .
          </p>
        )}
        <FormField
          control={form.control}
          name="mobile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile</FormLabel>
              <FormControl>
                <Input placeholder="98765 43210" inputMode="tel" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Indian mobile. Any format works — it is stored as +91 and ten digits.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormLabel>Email (optional)</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>
            Create invited account
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export { UserCreateDialog }
