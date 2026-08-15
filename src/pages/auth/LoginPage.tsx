import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import { useLoginMutation, useProfileQuery } from '@/api/auth'
import { applyApiErrorToForm, ApiClientError } from '@/lib/api-error'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLoginMutation()
  // If a live session already exists (e.g. back-button after logging in elsewhere in the
  // same browser), skip straight past the form instead of asking for credentials again.
  const profile = useProfileQuery()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  if (profile.data) {
    return <Navigate to="/" replace />
  }

  function onSubmit(values: FormValues) {
    login.mutate(values, {
      onSuccess: (data) => {
        const from = (location.state as { from?: Location } | null)?.from
        if (data.mustChangePassword) {
          navigate('/force-password-change', { replace: true })
        } else {
          navigate(from?.pathname ?? '/', { replace: true })
        }
      },
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
        <CardTitle>Sign in</CardTitle>
        <CardDescription>OMS admin access.</CardDescription>
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={login.isPending}>
              Sign in
            </Button>
            <Link
              to="/reset-password"
              className="text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Forgot your password?
            </Link>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default LoginPage
