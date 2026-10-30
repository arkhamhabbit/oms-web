import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoticeBanner, noticeFromError, type Notice } from '@/components/common/NoticeBanner'
import { PricingStateBadge } from '@/components/pricing/PricingStateBadge'
import { TierLadderEditor } from '@/components/membership/TierLadderEditor'
import { TierLadderTable } from '@/components/membership/TierLadderTable'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { usePermissions } from '@/auth/usePermissions'
import { isApiError, type ApiFieldError } from '@/lib/api-error'
import { describeFieldError, MEMBERSHIP_VERSION_LABELS } from '@/lib/field-labels'
import { localInputToInstant } from '@/lib/pricing'
import { draftsToRequest, membershipActions, tierToDraft, type TierDraft } from '@/lib/membership'
import {
  useMembershipVersionQuery,
  usePublishMembershipVersionMutation,
  useUpdateMembershipVersionMutation,
  useWithdrawMembershipVersionMutation,
  type MembershipVersion,
  type MembershipVersionState,
} from '@/api/membership'
import { formatDateTime } from '@/lib/dates'

/** A withdrawn version never took effect — it was only ever scheduled. */
const EFFECTIVE_VERB: Partial<Record<MembershipVersionState, string>> = {
  SCHEDULED: 'Takes effect',
  WITHDRAWN: 'Was scheduled for',
}


function BackLink() {
  return (
    <Link
      to="/membership"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" /> Membership
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

function MembershipVersionPage() {
  const { id = '' } = useParams()
  const { has } = usePermissions()
  const versionQuery = useMembershipVersionQuery(id)
  const version = versionQuery.data

  useBreadcrumb([{ label: 'Membership', to: '/membership' }, { label: version?.name ?? 'Version' }])

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
            : 'This membership version could not be loaded.'}
        </p>
      </div>
    )
  }

  const actions = membershipActions(version.state)
  const canWrite = has('membership.write')
  const canPublish = has('membership.publish')
  const editable = actions.editable && canWrite

  return (
    <div className="flex max-w-5xl flex-col gap-4">
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
        {' · '}
        {version.tiers?.length ?? 0} tiers
        {version.withdrawnAt && ` · withdrawn ${formatDateTime(version.withdrawnAt)}`}
      </p>

      {notice && (
        <NoticeBanner notice={notice} onReload={reload} onDismiss={() => setNotice(undefined)} />
      )}
      {!actions.editable && (
        <Explainer>
          A published or withdrawn version is immutable — members&apos; tiers and history cite it.
          To change the ladder, create a new draft; it starts as a copy of a version you choose.
        </Explainer>
      )}
      {actions.editable && !canWrite && (
        <Explainer>
          You can view this draft but not edit it — that needs the <code>membership.write</code>{' '}
          permission.
        </Explainer>
      )}

      {editable ? (
        // Keyed on the stored `version`: a save moves it and hands the form the saved ladder; a
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
              <CardTitle>Ladder</CardTitle>
              <CardDescription>Lowest tier first.</CardDescription>
            </CardHeader>
            <CardContent>
              <TierLadderTable tiers={version.tiers ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function DraftEditor({
  version,
  onError,
}: {
  version: MembershipVersion
  onError: (error: unknown) => void
}) {
  const update = useUpdateMembershipVersionMutation(version.id!)
  const [name, setName] = React.useState(version.name ?? '')
  const [notes, setNotes] = React.useState(version.notes ?? '')
  const [tiers, setTiers] = React.useState<TierDraft[]>(() =>
    (version.tiers ?? []).map(tierToDraft)
  )
  const [fieldErrors, setFieldErrors] = React.useState<ApiFieldError[]>([])
  const [refusal, setRefusal] = React.useState<string | undefined>()

  const request = draftsToRequest(tiers)

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
        tiers: request,
        version: version.version!,
      })
      .then(() => toast.success('Draft saved'))
      .catch((error) => {
        if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
          // The server's own sentences, by field where it names one and as a list otherwise.
          setFieldErrors(error.fieldErrors)
          setRefusal(error.message)
        } else {
          onError(error)
        }
      })
  }

  const tierErrors = fieldErrors.filter((e) => e.field.startsWith('tiers['))
  const otherErrors = fieldErrors.filter((e) => !e.field.startsWith('tiers['))

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
            {otherErrors
              .filter((e) => e.field === 'name')
              .map((e) => (
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
          <CardTitle>Ladder</CardTitle>
          <CardDescription>
            Lowest tier first. Reach promotes a member the moment they earn it in a cycle; maintain
            is the lower bar that keeps the tier at the cycle&apos;s end. Saving replaces the whole
            ladder.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TierLadderEditor tiers={tiers} onChange={setTiers} serverErrors={tierErrors} />
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
                  {describeFieldError(e, MEMBERSHIP_VERSION_LABELS)}
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

function LifecycleActions({
  version,
  canPublish,
  onError,
  onDone,
}: {
  version: MembershipVersion
  canPublish: boolean
  onError: (error: unknown) => void
  onDone: () => void
}) {
  const actions = membershipActions(version.state)
  const publish = usePublishMembershipVersionMutation(version.id!)
  const withdraw = useWithdrawMembershipVersionMutation(version.id!)
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
          Publishing needs <code>membership.publish</code>
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
        title="Publish membership version"
        confirmLabel={instant ? 'Schedule' : 'Publish now'}
        pending={publish.isPending}
        onConfirm={runPublish}
      >
        <p>
          Publishing makes this ladder immutable — for good, there is no unpublish. From the moment
          it takes effect it decides every member&apos;s promotions, who keeps their tier at a
          cycle&apos;s end, and the benefits each tier carries.
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
          is final: it will never take effect, and the version in effect now is untouched. No member
          has been resolved against it, so nothing is lost.
        </p>
      </ConfirmDialog>
    </div>
  )
}

export default MembershipVersionPage
