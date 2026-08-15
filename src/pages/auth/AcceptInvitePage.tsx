import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useAcceptInviteMutation } from '@/api/auth'
import { applyApiErrorToForm, ApiClientError } from '@/lib/api-error'

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

/**
 * The only way into the system for a freshly-seeded member — the Super Admin included, per
 * D5.8. `acceptInvite` returns 204 with no session: this sets the password and activates the
 * account, it does not log anyone in, so the member goes on to `/login` afterward.
 */
function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const acceptInvite = useAcceptInviteMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  })

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid invite link</CardTitle>
          <CardDescription>This link is missing its token. Ask for a new invite.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (acceptInvite.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Account activated
          </CardTitle>
          <CardDescription>Your password is set. You can sign in now.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  function onSubmit(values: FormValues) {
    acceptInvite.mutate(
      { token: token!, password: values.password },
      {
        onError: (error) => {
          if (error instanceof ApiClientError) {
            applyApiErrorToForm(error, form)
          }
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invite</CardTitle>
        <CardDescription>Set a password to activate your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={acceptInvite.isPending}>
              Activate account
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default AcceptInvitePage
