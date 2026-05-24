// ── Universal setBase resolution ────────────────────────────────
//
// `setBase` modifiers are name-valued (a `PrimaryAttributeName` chosen as
// the source for some derived value). When several effects compete for
// the same target — e.g. Sixth Sense Adept and Tactics Adept both
// authoring `secondary.defense ← <attr>` — the engine resolves them by
// picking the candidate whose **post-effect primary value is highest**,
// with the default included in the comparison so that an unfavourable
// override can never lower the derived field below its default-driven
// value.
//
// Algorithm: default-inclusive max-by-primary, stable on ties (first
// wins, which means the default wins ties because it is prepended).
//
// Used by:
//   - `applySetBase` consumers in `derived.recalculate` (secondary
//     attribute formula phase).
//   - per-slot `applySlotPhases` for `combat.attackAttribute`.
//   - `deriveMagicAttribute` / `deriveInitiativeAttribute`.
//
// Does NOT roll dice, read flags, or consider effect tier — pure
// best-of-pool by primary value.

import type { PrimaryAttributeName, PrimaryAttributes } from "#rpg-types";

export function resolveSetBase(
  defaultName: PrimaryAttributeName | null,
  candidates: PrimaryAttributeName[],
  primary: PrimaryAttributes,
): PrimaryAttributeName | undefined {
  if (candidates.length === 0) return defaultName ?? undefined;
  const pool: PrimaryAttributeName[] =
    defaultName !== null ? [defaultName, ...candidates] : [...candidates];
  let best = pool[0]!;
  let bestValue = primary[best] ?? 0;
  for (let i = 1; i < pool.length; i++) {
    const cur = pool[i]!;
    const curValue = primary[cur] ?? 0;
    if (curValue > bestValue) {
      best = cur;
      bestValue = curValue;
    }
  }
  return best;
}
