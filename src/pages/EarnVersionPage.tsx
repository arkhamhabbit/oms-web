import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { MoneyInput } from '@/components/form/MoneyInput'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { EarnRulesSummary } from '@/components/earn/EarnRulesSummary'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError, type ApiFieldError } from '@/lib/api-error'
import { describeFieldError, EARN_VERSION_LABELS } from '@/lib/field-labels'
import { localInputToInstant } from '@/lib/pricing'
import {
  draftToRequest,
  earnActions,
  parseWholeNumber,
  rulesToDraft,
  type EarnDraft,
} from '@/lib/earn'
import {
  useEarnRulesVersionQuery,
  usePublishEarnRulesMutation,
  useUpdateEarnRulesMutation,
  useWithdrawEarnRulesMutation,
  type EarnRules,
  type EarnRulesState,
} from '@/api/earn'
import { formatDateTime } from '@/lib/dates'

/** A withdrawn version never took effect — it was only ever scheduled. */
const EFFECTIVE_VERB: Partial<Record<EarnRulesState, string>> = {
  SCHEDULED: 'Takes effect',
  WITHDRAWN: 'Was scheduled for',
}


function BackLink() {
  return (
    <Link
      to="/earn"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Earn rules
    </Link>
  )
}

function Explainer({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function EarnVersionPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const versionQuery = useEarnRulesVersionQuery(id)
  const version = versionQuery.data

  useBreadcrumb([{ label: 'Earn rules', to: '/earn' }, { label: version?.name ?? 'Version' }])

  const [notice, setNotice] = React.useState<Notice | undefined>()

  function fail(error: unknown) {
    setNotice(noticeFromError(error, 'This draft'))
  }
  function reload() {
    setNotice(undefined)
    void versionQuery.refetch()
  }

  if (versionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (versionQuery.isError || !version) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">
          {isApiError(versionQuery.error)
            ? versionQuery.error.message
            : 'This earn rules version could not be loaded.'}
        </p>
      </div>
    )
  }

  const actions = earnActions(version.state)
  const canWrite = has('earn.write')
  const canPublish = has('earn.publish')
  const editable = actions.editable && canWrite

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{version.name}</h1>
          <PricingStateBadge state={version.state} />
        </div>
        <LifecycleActions
          version={version}
          canPublish={canPublish}
          onError={fail}
          onDone={() => setNotice(undefined)}
        />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {version.effectiveFrom
          ? `${EFFECTIVE_VERB[version.state!] ?? 'Took effect'} ${formatDateTime(version.effectiveFrom)}`
          : 'Not published'}
        {version.withdrawnAt && ` · withdrawn ${formatDateTime(version.withdrawnAt)}`}
      </p>

      {notice && (
        <NoticeBanner notice={notice} onReload={reload} onDismiss={() => setNotice(undefined)} />
      )}
      {!actions.editable && (
        <Explainer>
          A published or withdrawn version is immutable — every earn it set cites it. To change an
          amount, create a new draft; it starts as a copy of a version you choose.
        </Explainer>
      )}
      {actions.editable && !canWrite && (
        <Explainer>
          You can view this draft but not edit it — that needs the <code>earn.write</code>{' '}
          permission.
        </Explainer>
      )}

      {editable ? (
        // Keyed on the stored `version`: a save moves it and hands the form the saved amounts; a
        // refused save leaves it, so what the operator typed survives the refusal.
        <DraftEditor key={`draft-${version.version}`} version={version} onError={fail} />
      ) : (
        <>
          {version.notes && (
            <p className="text-sm">
              <span className="font-medium">Notes: </span>
              {version.notes}
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Amounts</CardTitle>
              <CardDescription>Bits are whole points; Carrots are in rupees.</CardDescription>
            </CardHeader>
            <CardContent>
              <EarnRulesSummary rules={version} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

const BITS_FIELDS = [
  ['welcomePoints', 'Welcome Bits', 'Credited when a customer’s account turns Active.'],
  [
    'referralJoinPoints',
    'Referral join Bits',
    'Paid to the inviter when the friend’s account activates.',
  ],
  [
    'profileCompletePoints',
    'Profile complete Bits',
    'Paid when the customer completes their profile. Stored; not yet triggered.',
  ],
  [
    'deviceConnectedPoints',
    'Device connected Bits',
    'Paid when the customer connects a device. Stored; not yet triggered.',
  ],
  ['firstOrderPoints', 'First order Bits', 'Paid for a customer’s own first confirmed order.'],
  [
    'orderPointsPer100Rupees',
    'Own-order Bits per ₹100',
    'Earned on goods paid in cash (after Carrots, before shipping), pro rata, rounded down.',
  ],
] as const

type BitsKey = (typeof BITS_FIELDS)[number][0]

function DraftEditor({
  version,
  onError,
}: {
  version: EarnRules
  onError: (error: unknown) => void
}) {
  const update = useUpdateEarnRulesMutation(version.id!)
  const [name, setName] = React.useState(version.name ?? '')
  const [notes, setNotes] = React.useState(version.notes ?? '')
  const [draft, setDraft] = React.useState<EarnDraft>(() => rulesToDraft(version))
  // What was typed in each Bits box, so a half-typed or minus-signed value is not rewritten.
  const [text, setText] = React.useState<Record<BitsKey, string>>(
    () =>
      Object.fromEntries(BITS_FIELDS.map(([key]) => [key, String(draft[key] ?? '')])) as Record<
        BitsKey,
        string
      >
  )
  const [fieldErrors, setFieldErrors] = React.useState<ApiFieldError[]>([])
  const [refusal, setRefusal] = React.useState<string | undefined>()

  const request = draftToRequest(draft)

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!request) {
      return
    }
    setFieldErrors([])
    setRefusal(undefined)
    update
      .mutateAsync({
        name: name.trim(),
        notes: notes.trim() || undefined,
        ...request,
        version: version.version!,
      })
      .then(() => toast.success('Draft saved'))
      .catch((error) => {
        if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
          // The server's own sentence, by field where it names one.
          setFieldErrors(error.fieldErrors)
          setRefusal(error.message)
        } else {
          onError(error)
        }
      })
  }

  const errorsFor = (field: string) => fieldErrors.filter((e) => e.field === field)

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="draft-name">Name</Label>
            <Input id="draft-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errorsFor('name').map((e) => (
              <p key={e.message} className="text-sm text-destructive">
                {e.message}
              </p>
            ))}
          </div>
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="draft-notes">Notes</Label>
            <Input id="draft-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Amounts</CardTitle>
          <CardDescription>
            Whole numbers, 0 or more; 0 means no earn. Bits are points, Carrots are typed in rupees.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field
            id="welcomePoints"
            label="Welcome Bits"
            help="Credited when a customer’s account turns Active."
            errors={errorsFor('welcomePoints')}
          >
            <BitsInput
              id="welcomePoints"
              text={text.welcomePoints}
              onText={(value) => {
                setText((t) => ({ ...t, welcomePoints: value }))
                setDraft((d) => ({ ...d, welcomePoints: parseWholeNumber(value) }))
              }}
            />
          </Field>
          <Field
            id="welcomeCarrotsMinor"
            label="Welcome Carrots (₹)"
            help="Credited with the welcome Bits when the account turns Active."
            errors={errorsFor('welcomeCarrotsMinor')}
          >
            <MoneyInput
              id="welcomeCarrotsMinor"
              valueMinor={draft.welcomeCarrotsMinor}
              onValueMinorChange={(v) => setDraft((d) => ({ ...d, welcomeCarrotsMinor: v }))}
            />
          </Field>
          {BITS_FIELDS.slice(1, 2).map(([key, label, help]) => (
            <Field key={key} id={key} label={label} help={help} errors={errorsFor(key)}>
              <BitsInput
                id={key}
                text={text[key]}
                onText={(value) => {
                  setText((t) => ({ ...t, [key]: value }))
                  setDraft((d) => ({ ...d, [key]: parseWholeNumber(value) }))
                }}
              />
            </Field>
          ))}
          <Field
            id="referralFirstOrderCarrotsMinor"
            label="Referral first-order Carrots (₹)"
            help="Paid to the inviter on the friend’s first order. Later orders pay the inviter’s tier rate."
            errors={errorsFor('referralFirstOrderCarrotsMinor')}
          >
            <MoneyInput
              id="referralFirstOrderCarrotsMinor"
              valueMinor={draft.referralFirstOrderCarrotsMinor}
              onValueMinorChange={(v) =>
                setDraft((d) => ({ ...d, referralFirstOrderCarrotsMinor: v }))
              }
            />
          </Field>
          {BITS_FIELDS.slice(2).map(([key, label, help]) => (
            <Field key={key} id={key} label={label} help={help} errors={errorsFor(key)}>
              <BitsInput
                id={key}
                text={text[key]}
                onText={(value) => {
                  setText((t) => ({ ...t, [key]: value }))
                  setDraft((d) => ({ ...d, [key]: parseWholeNumber(value) }))
                }}
              />
            </Field>
          ))}
          <Field
            id="orderCarrotsPer100RupeesMinor"
            label="Own-order Carrots per ₹100 (₹)"
            help="Earned on the same amount as the Bits above — ₹1 means ₹1 back per ₹100 paid in cash."
            errors={errorsFor('orderCarrotsPer100RupeesMinor')}
          >
            <MoneyInput
              id="orderCarrotsPer100RupeesMinor"
              valueMinor={draft.orderCarrotsPer100RupeesMinor}
              onValueMinorChange={(v) =>
                setDraft((d) => ({ ...d, orderCarrotsPer100RupeesMinor: v }))
              }
            />
          </Field>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-3">
              <Switch
                id="welcomeForLegacy"
                checked={draft.welcomeForLegacy}
                onCheckedChange={(checked) =>
                  setDraft((d) => ({ ...d, welcomeForLegacy: checked }))
                }
              />
              <Label htmlFor="welcomeForLegacy">Welcome bonus for legacy members</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Legacy members (imported with an opening balance) normally don&apos;t get the welcome
              bonus — their opening balance is their welcome.
            </p>
          </div>
        </CardContent>
      </Card>

      {refusal && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p>{refusal}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {fieldErrors.map((e) => (
                <li key={`${e.field}-${e.message}`}>
                  {describeFieldError(e, EARN_VERSION_LABELS)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <Button type="submit" disabled={!request || !name.trim() || update.isPending}>
          Save draft
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  help,
  errors,
  children,
}: {
  id: string
  label: string
  help: string
  errors: ApiFieldError[]
  children: React.ReactNode
}) {
  return (
    <div className="grid max-w-sm gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{help}</p>
      {errors.map((e) => (
        <p key={e.message} className="text-sm text-destructive">
          {e.message}
        </p>
      ))}
    </div>
  )
}

function BitsInput({
  id,
  text,
  onText,
}: {
  id: string
  text: string
  onText: (value: string) => void
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={text}
      aria-invalid={parseWholeNumber(text) === null}
      onChange={(e) => onText(e.target.value)}
    />
  )
}

function LifecycleActions({
  version,
  canPublish,
  onError,
  onDone,
}: {
  version: EarnRules
  canPublish: boolean
  onError: (error: unknown) => void
  onDone: () => void
}) {
  const actions = earnActions(version.state)
  const publish = usePublishEarnRulesMutation(version.id!)
  const withdraw = useWithdrawEarnRulesMutation(version.id!)
  const [publishOpen, setPublishOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [effectiveFrom, setEffectiveFrom] = React.useState('')
  // A hint only (the server refuses a backdated publish); judged when typed, not during render.
  const [inPast, setInPast] = React.useState(false)
  // The server's refusal of the chosen time (400 on `effectiveFrom`) — shown by the input, dialog open.
  const [timeError, setTimeError] = React.useState<string | undefined>()

  if (!actions.publishable && !actions.withdrawable) {
    return null
  }

  const instant = localInputToInstant(effectiveFrom)

  function runPublish() {
    setTimeError(undefined)
    publish
      .mutateAsync({ version: version.version!, effectiveFrom: instant })
      .then((published) => {
        setPublishOpen(false)
        onDone()
        toast.success(
          published.state === 'SCHEDULED'
            ? 'Version scheduled'
            : 'Version published — now in effect'
        )
      })
      .catch((error) => {
        const field = isApiError(error)
          ? error.fieldErrors.find((f) => f.field === 'effectiveFrom')
          : undefined
        if (field) {
          setTimeError(field.message)
          return
        }
        setPublishOpen(false)
        onError(error)
      })
  }

  function runWithdraw() {
    withdraw
      .mutateAsync(version.version!)
      .then(() => {
        setWithdrawOpen(false)
        onDone()
        toast.success('Scheduled version withdrawn')
      })
      .catch((error) => {
        setWithdrawOpen(false)
        onError(error)
      })
  }

  return (
    <div className="flex items-center gap-2">
      {!canPublish && (
        <span className="text-xs text-muted-foreground">
          Publishing needs <code>earn.publish</code>
        </span>
      )}
      {actions.publishable && (
        <Button disabled={!canPublish} onClick={() => setPublishOpen(true)}>
          Publish…
        </Button>
      )}
      {actions.withdrawable && (
        <Button variant="destructive" disabled={!canPublish} onClick={() => setWithdrawOpen(true)}>
          Withdraw…
        </Button>
      )}

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish earn rules"
        confirmLabel={instant ? 'Schedule' : 'Publish now'}
        pending={publish.isPending}
        onConfirm={runPublish}
      >
        <p>
          Publishing makes these amounts immutable — for good, there is no unpublish. From the
          moment it takes effect every welcome bonus and referral reward is paid at these amounts.
        </p>
        <div className="grid gap-1.5 text-foreground">
          <Label htmlFor="publish-effective-from">Takes effect (your local time)</Label>
          <Input
            id="publish-effective-from"
            type="datetime-local"
            value={effectiveFrom}
            onChange={(e) => {
              const next = localInputToInstant(e.target.value)
              setEffectiveFrom(e.target.value)
              setTimeError(undefined)
              setInPast(!!next && new Date(next).getTime() < Date.now())
            }}
          />
          <span className="text-xs text-muted-foreground">
            Leave empty to publish now. A future time schedules it; the current version stays in
            effect until then, and a scheduled version can still be withdrawn.
          </span>
          {timeError && (
            <span role="alert" className="text-sm text-destructive">
              Takes effect: {timeError}
            </span>
          )}
          {inPast && !timeError && (
            <span className="text-sm text-destructive">
              That time has passed — a version can&apos;t be backdated, so the server will refuse
              it.
            </span>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Withdraw scheduled version"
        confirmLabel="Withdraw"
        destructive
        pending={withdraw.isPending}
        onConfirm={runWithdraw}
      >
        <p>
          {version.name} was due to take effect {formatDateTime(version.effectiveFrom)}. Withdrawing it
          is final: it will never take effect, and the version in effect now is untouched. No earn
          has cited it, so nothing is lost.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export default EarnVersionPage
