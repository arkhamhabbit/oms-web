import * as React from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { ExternalLinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useAppSettingsQuery, useUpdateAppSettingsMutation } from '@/api/app-settings'
import { usePermissions } from '@/auth/usePermissions'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import {
  APP_SETTINGS_FIELDS,
  APP_SETTINGS_GROUPS,
  APP_SETTINGS_LABELS,
  isOpenable,
  sameAsRecord,
  toForm,
  toRequest,
  type AppSettings,
  type AppSettingsForm,
  type AppSettingsKey,
} from '@/lib/app-settings'
import { formatDateTime } from '@/lib/dates'
import { describeFieldError } from '@/lib/field-labels'
import { isApiError, isVersionConflict, type ApiFieldError } from '@/lib/api-error'

const KNOWN_KEYS = new Set<string>(APP_SETTINGS_FIELDS.map((f) => f.key))

function AppSettingsPage() {
  useBreadcrumb([{ label: 'App settings' }])
  const { has } = usePermissions()
  const canManage = has('app_settings.manage')
  const query = useAppSettingsQuery()
  // Bumped by Reload so the form is rebuilt from the server's record even if its version matched.
  const [reloads, setReloads] = React.useState(0)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        These appear in the app&apos;s menu. A field left empty is not shown in the app. Changes
        take effect without an app release.
      </p>
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {isApiError(query.error) ? query.error.message : 'The app settings could not be loaded.'}
        </p>
      )}
      {query.data && (
        <SettingsForm
          key={`${query.data.version}-${reloads}`}
          record={query.data}
          canManage={canManage}
          onReload={async () => {
            await query.refetch()
            setReloads((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

interface SettingsFormProps {
  record: AppSettings
  canManage: boolean
  onReload: () => Promise<void>
}

function SettingsForm({ record, canManage, onReload }: SettingsFormProps) {
  const { has } = usePermissions()
  const update = useUpdateAppSettingsMutation()
  const [form, setForm] = React.useState<AppSettingsForm>(() => toForm(record))
  const [fieldErrors, setFieldErrors] = React.useState<ApiFieldError[]>([])
  const [banner, setBanner] = React.useState<string | undefined>()
  const [conflict, setConflict] = React.useState(false)
  const [reloading, setReloading] = React.useState(false)

  const dirty = !sameAsRecord(form, record)

  // Leaving with unsaved changes asks first; closing the tab gets the browser's own prompt.
  const blocker = useBlocker(dirty && !update.isPending)
  React.useEffect(() => {
    if (!dirty) {
      return
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function change(key: AppSettingsKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // the sentence belonged to what was typed before
    setFieldErrors((prev) => prev.filter((e) => e.field !== key))
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!canManage) {
      return
    }
    setBanner(undefined)
    setConflict(false)
    setFieldErrors([])
    if (!dirty) {
      toast.info('Nothing changed, so nothing was saved.')
      return
    }
    update
      .mutateAsync(toRequest(form, record.version ?? 0))
      .then(() => toast.success('App settings saved'))
      .catch((error) => {
        if (isVersionConflict(error)) {
          setConflict(true)
          setBanner(isApiError(error) ? error.message : undefined)
        } else if (isApiError(error)) {
          setFieldErrors(error.fieldErrors)
          if (error.fieldErrors.length === 0) {
            setBanner(error.message)
          }
        } else {
          setBanner('The app settings could not be saved.')
        }
      })
  }

  const errorsFor = (key: string) => fieldErrors.filter((e) => e.field === key)
  const unplaced = fieldErrors.filter((e) => !KNOWN_KEYS.has(e.field))

  return (
    <form className="flex flex-col gap-4" onSubmit={save} noValidate>
      {APP_SETTINGS_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {group.fields.map((field) => {
              const errors = errorsFor(field.key)
              const id = `app-${field.key}`
              return (
                <div key={field.key} className="grid gap-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      type="text"
                      inputMode={field.inputMode}
                      value={form[field.key]}
                      onChange={(e) => change(field.key, e.target.value)}
                      readOnly={!canManage}
                      aria-invalid={errors.length > 0 ? true : undefined}
                      aria-describedby={errors.length > 0 ? `${id}-error` : undefined}
                    />
                    {field.link &&
                      (isOpenable(form[field.key]) ? (
                        <a
                          href={form[field.key].trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${field.label}`}
                          title="Open in a new tab"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border hover:bg-accent"
                        >
                          <ExternalLinkIcon className="size-4" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-label={`Open ${field.label}`}
                          title="Enter an https:// link to open it"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border opacity-40"
                        >
                          <ExternalLinkIcon className="size-4" />
                        </button>
                      ))}
                  </div>
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                  {errors.length > 0 && (
                    <div id={`${id}-error`}>
                      {errors.map((e) => (
                        <p key={e.message} className="text-sm text-destructive">
                          {e.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      {(banner || unplaced.length > 0) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {banner && <p>{banner}</p>}
          {unplaced.map((e) => (
            <p key={`${e.field}-${e.message}`}>{describeFieldError(e, APP_SETTINGS_LABELS)}</p>
          ))}
          {conflict && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={reloading}
              onClick={() => {
                setReloading(true)
                onReload().finally(() => setReloading(false))
              }}
            >
              Reload
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canManage ? (
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Changing these needs <code>app_settings.manage</code>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {record.version
            ? `Last changed on ${formatDateTime(record.updatedAt)}.`
            : 'Not changed yet.'}
        </p>
        {has('audit.read') && (
          <Link to="/audit?entityType=app_settings" className="text-sm underline">
            History
          </Link>
        )}
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') {
            blocker.reset()
          }
        }}
        title="Leave without saving?"
        confirmLabel="Leave"
        destructive
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
      >
        <p>You have changes that are not saved. Leaving this page discards them.</p>
      </ConfirmDialog>
    </form>
  )
}

export default AppSettingsPage
