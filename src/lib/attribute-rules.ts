import { ATTRIBUTE_UNITS } from '@/api/enums.gen'

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
 * D4.10's closed set, published as an enum in the contract (0.8) and emitted from it by
 * `scripts/generate-enums.mjs` — no hand-maintained copy to drift. The test pins the set so a
 * change on the server is a visible decision here, not a silent one.
 */
export const ALLOWED_UNITS = ATTRIBUTE_UNITS

export type AllowedUnit = (typeof ATTRIBUTE_UNITS)[number]
