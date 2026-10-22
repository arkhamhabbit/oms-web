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
  payload: ProfileIntake['payload']
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
      const id = text(p.addressId)
      return id ? `address ${id.slice(0, 8)}…` : '—'
    }
    default:
      return '—'
  }
}
