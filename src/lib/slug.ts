/**
 * Client-side preview only — mirrors `Slug.from()` on the OMS side closely enough to show the
 * operator what will be saved while they type. It is not authoritative: the server normalises
 * and validates independently, and its rejection (not this function) is what a mismatched or
 * invalid slug surfaces as.
 */
export function slugify(name: string): string {
  const folded = name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
