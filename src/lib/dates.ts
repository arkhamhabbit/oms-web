/**
 * Every date and time the console shows goes through here: en-IN, 24-hour, Asia/Kolkata
 * (`29 Oct 2026, 14:05`). The browser's own locale is never used, so two admins see the same
 * text for the same instant. This is the working default until the operator rules otherwise
 * (W3.0 #27); changing it is a change to this file only.
 */
const TIME_ZONE = 'Asia/Kolkata'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PARTS = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

interface Fields {
  day: number
  month: number
  year: number
  hour: string
  minute: string
}

function fieldsOf(instant: Date): Fields {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    PARTS.formatToParts(instant).find((part) => part.type === type)?.value ?? ''
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')),
    hour: get('hour'),
    minute: get('minute'),
  }
}

function dateText(f: Pick<Fields, 'day' | 'month' | 'year'>): string {
  return `${f.day} ${MONTHS[f.month - 1]} ${f.year}`
}

/** An instant as `29 Oct 2026, 14:05` in IST; empty for a missing or unreadable value. */
export function formatDateTime(value: string | undefined | null): string {
  if (!value) {
    return ''
  }
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) {
    return value
  }
  const f = fieldsOf(instant)
  return `${dateText(f)}, ${f.hour}:${f.minute}`
}

/**
 * A calendar date as `29 Oct 2026`. A plain `YYYY-MM-DD` is already a date and is shown as it
 * is, with no timezone shift; an instant is shown as its IST calendar day.
 */
export function formatDate(value: string | undefined | null): string {
  if (!value) {
    return ''
  }
  const plain = PLAIN_DATE.exec(value)
  if (plain) {
    return dateText({ year: Number(plain[1]), month: Number(plain[2]), day: Number(plain[3]) })
  }
  const instant = new Date(value)
  return Number.isNaN(instant.getTime()) ? value : dateText(fieldsOf(instant))
}
