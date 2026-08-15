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
import { useCompletePasswordResetMutation, useRequestPasswordResetMutation } from '@/api/auth'
import { applyApiErrorToForm, ApiClientError } from '@/lib/api-error'

const requestSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})
type RequestFormValues = z.infer<typeof requestSchema>

const completeSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})
type CompleteFormValues = z.infer<typeof completeSchema>

/** No token in the URL: ask for the email to send a reset link to. */
function RequestResetForm() {
  const requestReset = useRequestPasswordResetMutation()
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  })

  if (requestReset.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Check your email
          </CardTitle>
          <CardDescription>
            If that address has an account, a reset link is on its way.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  function onSubmit(values: RequestFormValues) {
    requestReset.mutate(values, {
      onError: (error) => {
        if (error instanceof ApiClientError) {
          applyApiErrorToForm(error, form)
        }
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Enter your email to receive a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@habbit.com" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={requestReset.isPending}>
              Send reset link
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

/** `?token=...` present: the link from the email (or the startup log). Set the new password. */
function CompleteResetForm({ token }: { token: string }) {
  const completeReset = useCompletePasswordResetMutation()
  const form = useForm<CompleteFormValues>({
    resolver: zodResolver(completeSchema),
    defaultValues: { password: '' },
  })

  if (completeReset.isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Password updated
          </CardTitle>
          <CardDescription>You can sign in with your new password now.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  function onSubmit(values: CompleteFormValues) {
    completeReset.mutate(
      { token, password: values.password },
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
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>This link can only be used once.</CardDescription>
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
            <Button type="submit" className="w-full" disabled={completeReset.isPending}>
              Set new password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return token ? <CompleteResetForm token={token} /> : <RequestResetForm />
}

export default ResetPasswordPage
