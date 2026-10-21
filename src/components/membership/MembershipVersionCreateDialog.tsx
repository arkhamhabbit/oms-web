import * as React from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isApiError } from '@/lib/api-error'
import { draftsToRequest, tierToDraft } from '@/lib/membership'
import {
  useCreateMembershipVersionMutation,
  useEffectiveVersionQuery,
  useMembershipVersionsQuery,
} from '@/api/membership'

const EFFECTIVE_NOW = 'EFFECTIVE_NOW'

function MembershipVersionCreateDialog({
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
          <DialogTitle>New membership draft</DialogTitle>
          <DialogDescription>
            A draft starts as a copy of another version&apos;s ladder — reach and maintain
            thresholds, Carrots and benefits included — so a change is a few edits. It governs
            nothing until it is published.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts from an empty form. */}
        {open && <CreateForm onOpenChange={onOpenChange} onCreated={onCreated} />}
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
  const create = useCreateMembershipVersionMutation()
  const effective = useEffectiveVersionQuery()
  const versions = useMembershipVersionsQuery({ page: 0, size: 50 })
  const [name, setName] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [basedOn, setBasedOn] = React.useState(EFFECTIVE_NOW)
  const [error, setError] = React.useState<string | undefined>()

  const source =
    basedOn === EFFECTIVE_NOW
      ? effective.data
      : versions.data?.content?.find((v) => v.id === basedOn)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(undefined)
    const tiers = draftsToRequest((source?.tiers ?? []).map(tierToDraft))
    if (!tiers || tiers.length === 0) {
      setError('The ladder to copy has not loaded.')
      return
    }
    create
      .mutateAsync({ name: name.trim(), notes: notes.trim() || undefined, tiers })
      .then((version) => {
        toast.success('Draft created')
        onOpenChange(false)
        onCreated(version.id!)
      })
      .catch((e) => setError(isApiError(e) ? e.message : 'The draft could not be created.'))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="new-version-name">Name</Label>
        <Input
          id="new-version-name"
          placeholder="Diwali ladder"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-version-notes">Notes (optional)</Label>
        <Input id="new-version-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-version-from">Start from</Label>
        <Select value={basedOn} onValueChange={setBasedOn}>
          <SelectTrigger id="new-version-from" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EFFECTIVE_NOW}>The version in effect now (usual)</SelectItem>
            {(versions.data?.content ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id!}>
                {v.name} — {v.state?.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!name.trim() || !source || create.isPending}>
          Create draft
        </Button>
      </DialogFooter>
    </form>
  )
}

export { MembershipVersionCreateDialog }
