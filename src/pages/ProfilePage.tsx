import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { applyApiErrorToForm, ApiClientError } from '@/lib/api-error'
import {
  useChangePasswordMutation,
  useProfileQuery,
  useUpdateProfileMutation,
} from '@/api/auth'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(30).optional(),
})
type ProfileFormValues = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(1, 'Required'),
})
type PasswordFormValues = z.infer<typeof passwordSchema>

function ProfileDetailsCard() {
  const profile = useProfileQuery()
  const updateProfile = useUpdateProfileMutation()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', phone: '' },
  })

  // The query resolves after the form already mounted with empty defaults — reset once the
  // real values arrive rather than fighting React Query over what the initial render shows.
  useEffect(() => {
    if (profile.data) {
      form.reset({ name: profile.data.name, phone: profile.data.phone ?? '' })
    }
  }, [profile.data, form])

  function onSubmit(values: ProfileFormValues) {
    updateProfile.mutate(values, {
      onSuccess: () => toast.success('Profile updated'),
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
        <CardTitle>Profile</CardTitle>
        <CardDescription>{profile.data?.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {profile.data && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{profile.data.status}</Badge>
            {(profile.data.roles ?? []).map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
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
            <div>
              <Button type="submit" disabled={updateProfile.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function ChangePasswordCard() {
  const changePassword = useChangePasswordMutation()
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  function onSubmit(values: PasswordFormValues) {
    changePassword.mutate(values, {
      onSuccess: (data) => {
        form.reset()
        const otherSessionsSignedOut = data.otherSessionsSignedOut ?? 0
        toast.success(
          otherSessionsSignedOut > 0
            ? `Password changed. Signed out ${otherSessionsSignedOut} other session(s).`
            : 'Password changed.'
        )
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
        <CardTitle>Change password</CardTitle>
        <CardDescription>Changing your password signs out every other session.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
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
                  <FormDescription>The other things they told you not to reuse.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Button type="submit" disabled={changePassword.isPending}>
                Change password
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function ProfilePage() {
  useBreadcrumb([{ label: 'Profile' }])

  return (
    <div className="flex max-w-md flex-col gap-6">
      <ProfileDetailsCard />
      <ChangePasswordCard />
    </div>
  )
}

export default ProfilePage
