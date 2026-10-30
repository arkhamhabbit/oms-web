/**
 * Pickers offer what can be chosen today: active entries only. The one already assigned stays in
 * the list when it has gone inactive, so the control still shows what the record holds instead of
 * going blank, and it is marked so nobody picks it by mistake. The server stays authoritative; this
 * only stops the console offering what it would refuse.
 */
export function keepActive<T extends { id?: string }>(
  items: readonly T[],
  isActive: (item: T) => boolean,
  keepIds: readonly (string | undefined)[] = []
): T[] {
  return items.filter((item) => isActive(item) || (!!item.id && keepIds.includes(item.id)))
}

/** An attribute or attribute value is active unless the contract says otherwise. */
export const isActiveFlag = (item: { active?: boolean }): boolean => item.active !== false

/** A catalog entry (brand, category, product) is active when its status is ACTIVE. */
export const isActiveStatus = (item: { status?: string }): boolean => item.status === 'ACTIVE'

export const INACTIVE_MARK = 'Inactive'

/** The text for a picker row: its name, marked when it is not active. */
export function markInactive(name: string | undefined, active: boolean): string {
  const text = name ?? ''
  return active ? text : `${text} (${INACTIVE_MARK})`
}
