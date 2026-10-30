import type { ProfileIntake } from '@/api/users'

export const INTAKE_KIND: Record<NonNullable<ProfileIntake['kind']>, string> = {
  NAME: 'Name',
  EMAIL: 'Email',
  ADDRESS_UPSERT: 'Address saved',
  ADDRESS_DELETE: 'Address deleted',
}

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

/** One line describing what a change asked for; payload shapes per kind are published in intake.json. */
export function summarizeIntakePayload(
  kind: ProfileIntake['kind'],
  payload: ProfileIntake['payload'],
  address?: ProfileIntake['address']
): string {
  const p = payload ?? {}
  switch (kind) {
    case 'NAME':
      return text(p.name) ?? '—'
    case 'EMAIL':
      return text(p.email) ?? '—'
    case 'ADDRESS_UPSERT': {
      const parts = [text(p.label), text(p.line1), text(p.pincode)].filter(Boolean)
      return parts.length > 0 ? parts.join(' · ') : '—'
    }
    case 'ADDRESS_DELETE': {
      // OMS reads the address back (it is never erased), so a deleted one still has its label.
      const named = address ? [text(address.label), text(address.line1)].filter(Boolean) : []
      if (named.length > 0) {
        return named.join(' · ')
      }
      return text(p.addressId) ? 'An address that is no longer on record' : '—'
    }
    default:
      return '—'
  }
}
