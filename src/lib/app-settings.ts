import type { components } from '@/api/schema.gen'

type Schemas = components['schemas']

export type AppSettings = Schemas['AppSettingsResponse']
export type UpdateAppSettingsRequest = Schemas['UpdateAppSettingsRequest']

/** The seventeen values the record holds; the form edits exactly these, as text. */
export type AppSettingsKey = Exclude<keyof UpdateAppSettingsRequest, 'version'>
export type AppSettingsForm = Record<AppSettingsKey, string>

export interface AppSettingsField {
  key: AppSettingsKey
  /** The label the app's menu uses. */
  label: string
  help?: string
  /** A link gets the Open icon, enabled only for an https:// value. */
  link?: boolean
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
  placeholder?: string
}

export interface AppSettingsGroup {
  title: string
  fields: AppSettingsField[]
}

export const APP_SETTINGS_GROUPS: AppSettingsGroup[] = [
  {
    title: 'Pages',
    fields: [
      { key: 'aboutUrl', label: 'About Habbit', link: true },
      { key: 'partnerUrl', label: 'Become a Habbit Partner', link: true },
      { key: 'magazineUrl', label: 'Habbit Magazine', link: true },
      { key: 'faqUrl', label: 'Every Asked Question (FAQ)', link: true },
    ],
  },
  {
    title: 'Support',
    fields: [
      {
        key: 'supportUrl',
        label: 'Get Support',
        help: 'A web page, or a WhatsApp link such as https://wa.me/91…',
        link: true,
      },
      { key: 'supportEmail', label: 'Support email', inputMode: 'email' },
      { key: 'supportPhone', label: 'Support phone', inputMode: 'tel' },
    ],
  },
  {
    title: 'Policies',
    fields: [
      { key: 'privacyUrl', label: 'Privacy', link: true },
      { key: 'termsUrl', label: 'Terms', link: true },
      { key: 'policiesUrl', label: 'Policies', link: true },
    ],
  },
  {
    title: 'Company information',
    fields: [
      { key: 'companyLegalName', label: 'Registered legal name' },
      {
        key: 'fssaiLicenceNumber',
        label: 'FSSAI licence number',
        help: '14 digits.',
        inputMode: 'numeric',
      },
    ],
  },
  {
    title: 'Follow Habbit',
    fields: [
      { key: 'instagramUrl', label: 'Instagram', link: true },
      { key: 'xUrl', label: 'X', link: true },
      { key: 'youtubeUrl', label: 'YouTube', link: true },
      { key: 'linkedinUrl', label: 'LinkedIn', link: true },
      { key: 'facebookUrl', label: 'Facebook', link: true },
    ],
  },
]

export const APP_SETTINGS_FIELDS: AppSettingsField[] = APP_SETTINGS_GROUPS.flatMap((g) => g.fields)

export const APP_SETTINGS_LABELS: Record<string, string> = Object.fromEntries(
  APP_SETTINGS_FIELDS.map((f) => [f.key, f.label])
)

/** What the form shows for a record: a null is an empty box. */
export function toForm(record: AppSettings | undefined): AppSettingsForm {
  const form = {} as AppSettingsForm
  for (const field of APP_SETTINGS_FIELDS) {
    form[field.key] = record?.[field.key] ?? ''
  }
  return form
}

/**
 * The whole record, always: every field is present, an empty or blank one as null. The API
 * replaces the record with what it is sent, so a field left out would be cleared.
 */
export function toRequest(form: AppSettingsForm, version: number): UpdateAppSettingsRequest {
  const request = { version } as UpdateAppSettingsRequest
  for (const field of APP_SETTINGS_FIELDS) {
    const value = form[field.key].trim()
    request[field.key] = value === '' ? null : value
  }
  return request
}

/** True when the form, once normalised the way a save would send it, equals what the record holds. */
export function sameAsRecord(form: AppSettingsForm, record: AppSettings | undefined): boolean {
  const request = toRequest(form, 0)
  return APP_SETTINGS_FIELDS.every((f) => (request[f.key] ?? null) === (record?.[f.key] ?? null))
}

/** The Open icon is live only for a value the app could open: lowercase https://, no spaces. */
export function isOpenable(value: string): boolean {
  const v = value.trim()
  return v.startsWith('https://') && v.length > 'https://'.length && !/\s/.test(v)
}
