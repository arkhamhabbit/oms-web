import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

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
import { useChangePasswordMutation, useProfileQuery } from '@/api/auth'
import { applyApiErrorToForm, ApiClientError } from '@/lib/api-error'

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

/**
 * Sits between login and the app shell for a member whose `mustChangePassword` flag is set
 * — typically after an admin resets their password (D3.4 / task section 3: "handled, not
 * skipped"). Not reachable once the flag clears; `RequireAuth` sends the member here in the
 * first place, so this page redirects them straight past itself once it's done.
 */
function ForcePasswordChangePage() {
  const profile = useProfileQuery()
  const navigate = useNavigate()
  const changePassword = useChangePasswordMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  if (profile.isError) {
    return <Navigate to="/login" replace />
  }

  if (profile.data && !profile.data.mustChangePassword) {
    return <Navigate to="/" replace />
  }

  function onSubmit(values: FormValues) {
    changePassword.mutate(values, {
      onSuccess: () => navigate('/', { replace: true }),
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
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Your password was reset by an administrator. Set a new one to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current (temporary) password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
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
            <Button type="submit" className="w-full" disabled={changePassword.isPending}>
              Set new password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default ForcePasswordChangePage
