/**
 * D4.10 — an OPTION attribute is always single-select and always variant-level. This is
 * enforced by the server regardless of what the form does (D2.17: client gating is
 * convenience, never security) — this function only keeps the form's own state honest so the
 * operator never submits a combination the server would reject.
 */

export type AttributeKind = 'OPTION' | 'SPEC'
export type AttributeDataType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT'
export type AttributeAppliesTo = 'PRODUCT' | 'VARIANT'

export interface AttributeKindConstrainedFields {
  dataType: AttributeDataType
  appliesTo: AttributeAppliesTo
}

/**
 * Given the operator's chosen `kind` and their current `dataType`/`appliesTo` picks, returns
 * what the form should actually hold. For `OPTION` this always forces
 * `dataType = SINGLE_SELECT` and `appliesTo = VARIANT`, overriding whatever was picked before —
 * for `SPEC` it passes the current picks through unchanged.
 */
export function applyKindConstraint(
  kind: AttributeKind,
  current: AttributeKindConstrainedFields
): AttributeKindConstrainedFields {
  if (kind === 'OPTION') {
    return { dataType: 'SINGLE_SELECT', appliesTo: 'VARIANT' }
  }
  return current
}

/** Whether the data-type/applies-to fields are locked to the OPTION rule right now. */
export function isKindConstraintLocked(kind: AttributeKind): boolean {
  return kind === 'OPTION'
}

/** `unit` is only meaningful — and only ever shown — for a NUMBER attribute (D4.10). */
export function unitApplies(dataType: AttributeDataType): boolean {
  return dataType === 'NUMBER'
}

/** Whether this data type has attribute values at all (Values screen — SINGLE/MULTI select only). */
export function hasValues(dataType: AttributeDataType): boolean {
  return dataType === 'SINGLE_SELECT' || dataType === 'MULTI_SELECT'
}

/**
 * D4.10's closed set. **Contract gap**: `unit` is typed as a plain `string` in the published
 * OpenAPI contract (`AttributeResponse.unit`, `CreateAttributeRequest.unit`, ...), not as an
 * enum — so this list is sourced from the locked decision doc, not from the schema, and the UI
 * cannot verify it stays in sync with `Attribute.ALLOWED_UNITS` on the server. Flagged in the
 * task's Status block; the fix belongs in the contract (an enum on `unit`), not here.
 */
export const ALLOWED_UNITS = [
  'g',
  'mg',
  'kg',
  'ml',
  'l',
  'kcal',
  'iu',
  'mcg',
  'servings',
  'days',
  'pieces',
] as const

export type AllowedUnit = (typeof ALLOWED_UNITS)[number]
