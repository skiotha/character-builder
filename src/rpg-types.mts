// ── Primary & Secondary Attributes ───────────────────────────────

export interface PrimaryAttributes {
  accurate: number;
  cunning: number;
  discreet: number;
  appealing: number;
  quick: number;
  resolute: number;
  vigilant: number;
  strong: number;
}

export type PrimaryAttributeName = keyof PrimaryAttributes;

export interface Toughness {
  max: number;
  current: number;
}

export interface SecondaryAttributes {
  toughness: Toughness;
  defense: number;
  armor: number;
  painThreshold: number;
  corruptionThreshold: number;
  corruptionMax: number;
}

export interface CharacterAttributes {
  /**
   * Player-authored base values. Validated to [5, 15] per stat. Never
   * mutated by the engine — recalc reads these as the starting point
   * for `primaryEffective`.
   */
  primary: PrimaryAttributes;
  /**
   * Recalc-output snapshot: `primary` + all `kind: "primary"` effect
   * modifiers (addFlat, cap). May exceed 15. Server-controlled — clients
   * receive it for display but cannot write it. All downstream engine
   * stages (secondary formulas, setBase override resolution, future
   * combat/magic derivations) read primaries via `readPrimary`, which
   * pulls from this field.
   */
  primaryEffective: PrimaryAttributes;
  secondary: SecondaryAttributes;
}

// ── Effects (raw / wire shape) ───────────────────────────────────
//
// `RawEffect` is the legacy untyped wire shape used by `character.effects[]`,
// `Weapon.effects[]`, and `ArmorPiece` index-signature metadata. It is
// translated into `ResolvedEffect` at the boundary by
// `src/rules/effects.mts#normalizeRawEffect`. No code under `src/rules/`
// other than `effects.mts` should consume `RawEffect` directly.
//
// Lifecycle (`duration`) is **not** modeled by the engine — sibling apps
// own temporary state. The `duration` field is ignored at normalization
// time. `priority` is likewise ignored (phase ordering replaces it).
//
// Scheduled for removal in Phase 6 / Chunk H once the reference catalog
// is fully normalized to the new vocabulary (Chunk F).

/** @deprecated Wire shape only. Use `ResolvedEffect` inside the engine. */
export interface RawEffectModifier {
  type: string;
  value?: unknown;
}

/** @deprecated Wire shape only. Use `ResolvedEffect` inside the engine. */
export interface RawEffect {
  id?: string;
  source?: string;
  name?: string;
  description?: string;
  target?: unknown;
  modifier: RawEffectModifier;
  appliesTo?: unknown;
  /** Ignored by the engine — sibling apps own lifecycle. */
  duration?: string | null;
  /** Ignored by the engine — phase ordering replaces priority. */
  priority?: number;
  /** Nested effects unwound by `collectAllEffects`. */
  effects?: RawEffect[];
}

// ── Effects (typed engine shape, ADR-015) ────────────────────────

export type SecondaryAttributeName = keyof SecondaryAttributes;

// `CombatSlotField` enumerates the *numeric / scalar* per-slot fields a
// `combat`-targeted effect may address. Per-slot `qualities` and `flags`
// are set-membership; effects mutate them via `weaponQuality` /
// `flag` targets (with `appliesTo` narrowing the slot), not via a
// dedicated `combat` field. See ADR-015 §3a.
export type CombatSlotField = "attackAttribute" | "baseDamage" | "bonusDamage";

export type EffectFlag =
  | "evasion"
  | "advantage"
  | "deathDenial"
  | "darkvision"
  | "initiativeExemption"
  | "fastSwap"
  | "elementsProtection"
  | "fireResistance"
  | "poisonResistance"
  | "knowledge:alchemy"
  | "knowledge:alchemy:poisons"
  | "knowledge:world"
  | "knowledge:world:nature"
  | "knowledge:world:warfare"
  | "knowledge:world:geography"
  | "knowledge:world:underworld"
  | "knowledge:world:commerce"
  | "knowledge:magic"
  | "knowledge:magic:arcane"
  | "knowledge:magic:nature"
  | "knowledge:magic:light"
  | "knowledge:magic:elementalism"
  | "knowledge:magic:fel"
  | "knowledge:magic:shadow"
  | "knowledge:magic:enchantment"
  | "trueSight";
// NOTE: This is a placeholder starting set. The authoring pass in Chunk F
// will surface the real vocabulary; this enum is expected to expand.

export type EffectTarget =
  | { kind: "primary"; stat: PrimaryAttributeName }
  | { kind: "secondary"; stat: SecondaryAttributeName }
  | { kind: "combat"; field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality"; quality: string }
  | { kind: "flag"; name: EffectFlag }
  | { kind: "magicAttribute" }
  | { kind: "initiativeAttribute" };

export type WeaponPredicate =
  | { kind: "any" }
  | { kind: "type"; values: string[] }
  | { kind: "quality"; values: string[] }
  | { kind: "id"; values: string[] };

// `ArmorCondition` is the character-level gate for an effect (ADR-015 §3f).
// Distinct from `WeaponPredicate`/`appliesTo`, which narrows per-slot
// fanout in the combat phase. AND-list semantics across the array;
// OR-within-`values[]`. Only valid on `kind: "secondary"` and
// `kind: "armorQuality"` targets — parser strips elsewhere with a warn.
//
//   armorQuality — at least one equipped armor piece carries the quality
//                  in its `qualitiesEffective`
//   armorId      — at least one equipped armor piece has matching `id`
//   armorSlot    — listed slot(s) currently carry a non-null armor piece;
//                  also used as the implicit gate for registry-synthesized
//                  `armorQuality` effects so they don't bleed across slots
//   noArmor      — both `body` and `plug` slots are empty
export type ArmorCondition =
  | { kind: "armorQuality"; values: string[] }
  | { kind: "armorId"; values: string[] }
  | { kind: "armorSlot"; values: ("body" | "plug")[] }
  | { kind: "noArmor" };

export type EffectModifier =
  | { type: "setBase"; value: PrimaryAttributeName }
  | { type: "addFlat"; value: number }
  | { type: "multiply"; value: number }
  | { type: "cap"; value: number }
  | { type: "remove" };

export type EffectPhase =
  | "primary"
  | "setBase"
  | "formula"
  | "addFlat"
  | "multiply"
  | "cap"
  | "flag";

export interface ResolvedEffect {
  source: string;
  target: EffectTarget;
  modifier: EffectModifier;
  appliesTo?: WeaponPredicate[];
  /**
   * Character-level gate (ADR-015 §3f). Independent of `appliesTo`.
   * AND-list across entries; OR-within `values[]`. Only meaningful on
   * `target.kind ∈ {"secondary", "armorQuality"}`; parser strips with a
   * warn when present on other target kinds.
   */
  condition?: ArmorCondition[];
}

// ── Triggered Actions (ADR-014) ──────────────────────────────────

export type TriggerKind =
  | "manual"
  | "onTurnStart"
  | "onTurnEnd"
  | "onAttacked"
  | "onDamaged"
  | "onCrit"
  | "onAllyDamaged"
  | "onSpellCast"
  | "onMovement"
  | "onSightOf"
  | "onRageStart"
  | "onRageEnd";

export interface Action {
  /**
   * REQUIRED stable identifier. Locale-independent. Used for
   * rewrite-group dedupe in the engine: when two actions share the
   * same `id`, the one granted at the higher ability rank
   * (master > adept > novice) replaces the lower (ADR-014, Item 9).
   *
   * Authoring convention: prefix with the parent ability/spell id,
   * e.g. `intrigues-backstab`, `sulfur-cascade-scorch`. The lint in
   * `scripts/audit-reference.mts` enforces presence and per-tier /
   * cross-parent uniqueness.
   */
  id: string;
  name: string;
  trigger: TriggerKind;
  attackAttribute?: PrimaryAttributeName;
  damage?: number;
  effects?: ResolvedEffect[];
}

export type SpecialAttack = Action & { trigger: "manual" };
export type Reaction = Action & { trigger: Exclude<TriggerKind, "manual"> };

// ── Learned Traits, Talents & Progression ────────────────────────

export type AbilityTier = "novice" | "adept" | "master";

export type TraitSource = "ability" | "spell";

export type TalentSource = "sin" | "boon";

export interface LearnedTrait {
  id: string;
  tier: AbilityTier;
  source: TraitSource;
}

export interface LearnedRitual {
  id: string;
  level: number;
}

export interface LearnedTalent {
  id: string;
  level: number;
  source: TalentSource;
}

// ── Combat (ADR-014: per-slot, derived) ──────────────────────────
//
// Slot naming convention (canonical — use these names everywhere, never
// numeric indices in prose, UI labels or commit messages):
//
//   index 0 → "main-hand" — carried weapon, optional, may be null
//   index 1 → "off-hand"  — carried weapon, optional, may be null
//   index 2 → "own"       — innate weapon, required, never null,
//                            must reference a weapon with the `own` quality
//
// All `CombatSlot` fields except `weaponIndex` are server-derived. The
// combat phase is stubbed in Chunk C; per-slot fanout and weapon
// predicates land in Chunk E.

export interface CombatSlot {
  weaponIndex: number;
  attackAttribute: PrimaryAttributeName;
  baseDamage: number;
  bonusDamage: number;
  qualities: string[];
  flags: string[];
}

export interface Combat {
  carried: [CombatSlot | null, CombatSlot | null, CombatSlot];
}

// ── Equipment ─────────────────────────────────────────────────────
//
// `Weapon` / `ArmorPiece` model an *instance* the character carries.
// Reference catalog entries (`reference/weapons.*.json`,
// `reference/armor.*.json`) currently use a structurally compatible shape
// but are loaded as plain JSON; the registry deserializer (Chunk G) will
// validate them against this shape. Effects on equipment are typed
// `ResolvedEffect[]` — Chunk F authoring produces this shape directly.

export interface Weapon {
  id: string;
  name: string;
  type: string;
  damage: number;
  qualities: string[];
  cost?: number | string;
  /** Effects intrinsic to this weapon. When the weapon occupies a
   *  combat slot, these effects are applied to that slot only
   *  (implicit `appliesTo` = this weapon). */
  effects?: ResolvedEffect[];
}

export interface ArmorPiece {
  id: string;
  name: string;
  armor: number;
  qualities: string[];
  /**
   * Recalc-output snapshot of the piece's qualities after registry
   * fan-out and `armorQuality`-targeted effects have applied. Server-
   * controlled — clients receive it for display but cannot write it.
   * Engine consumers (other effect phases, sibling-app readers) should
   * read qualities through this field; `qualities` is the authored set
   * and is never mutated by the engine. Mirrors
   * `primary` / `primaryEffective`. Optional in the type so existing
   * on-disk fixtures load cleanly; engine populates it on every recalc
   * (when `recalculate()` runs, the field is reset from `qualities`
   * before any `armorQuality` effect applies — Bug #31 reset pattern).
   */
  qualitiesEffective?: string[];
  cost?: number | string;
  /** Effects intrinsic to this armor piece. Applied globally during
   *  recalc (collected by `collectAllEffects`). */
  effects?: ResolvedEffect[];
}

// ── Quality registry (ADR-016) ────────────────────────────────────
//
// Boilerplate-effect registry for weapon/armor qualities. A flat keyed
// map (no weapon/armor split — single namespace). The engine looks up
// each id mentioned in `Weapon.qualities` / `ArmorPiece.qualities` and
// fans out the registry's `effects[]` with implicit `appliesTo`:
//   * weapon-mounted qualities → scoped to the carrying weapon
//   * armor-mounted qualities → applied globally
//
// Localized fields (`name`, `description`) are display-only; the engine
// never reads them. `effects[]` is byte-identical across locale files
// (the locale-drift lint enforces).

export interface Quality {
  id: string;
  name?: string;
  description?: string;
  effects: ResolvedEffect[];
}

export interface Rune {
  name: string;
  description?: string;
  qualities: string[];
}

export interface CharacterEquipment {
  money: number;
  weapons: Weapon[];
  ammunition: unknown[];
  armor: {
    body: ArmorPiece | null;
    plug: ArmorPiece | null;
  };
  runes: Rune[];
  assassin: unknown[];
  tools: unknown[];
  inventory: {
    carried: unknown[];
    home: unknown[];
  };
  artifacts: unknown[];
}

// ── Affiliations ──────────────────────────────────────────────────

export interface Affiliation {
  name: string;
  reputation: number;
}

// ── Background ────────────────────────────────────────────────────

export interface JournalEntry {
  [key: string]: unknown;
}

export interface CharacterBackground {
  race: string;
  shadow?: string;
  age: number;
  profession?: string;
  journal: {
    open: JournalEntry[];
    done: JournalEntry[];
    rumours: JournalEntry[];
  };
  notes: unknown[];
  kinkList: unknown[];
}

// ── Portrait ──────────────────────────────────────────────────────

export interface PortraitCrop {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface PortraitDimensions {
  width: number;
  height: number;
}

export interface CharacterPortrait {
  path: string;
  crop: PortraitCrop;
  dimensions: PortraitDimensions;
  status: string;
}

// ── Permissions ───────────────────────────────────────────────────

export interface RoleAccess {
  read: boolean;
  write: boolean;
}

export interface FieldAccessMap {
  owner: RoleAccess;
  dm: RoleAccess;
  public: RoleAccess;
}

// ── Character ─────────────────────────────────────────────────────

export interface Character {
  id: string;
  backupCode: string;
  schemaVersion: number;
  playerId: string;
  player: string;
  characterName: string;
  created: string;
  lastModified: string;
  attributes: CharacterAttributes;
  combat: Combat;
  /**
   * Server-derived primary attribute used when rolling magic-bearing
   * abilities (spells, rituals, scrolls). Default `"resolute"`. Engine
   * resolves via `resolveSetBase` against `kind: "magicAttribute"`
   * effects (setBase only). Read by sibling apps at roll time.
   */
  magicAttribute: PrimaryAttributeName;
  /**
   * Server-derived primary attribute used when rolling initiative.
   * Default `"quick"`. Engine resolves via `resolveSetBase` against
   * `kind: "initiativeAttribute"` effects (setBase only). Read by
   * sibling apps at combat start.
   */
  initiativeAttribute: PrimaryAttributeName;
  experience: {
    total: number;
    unspent: number;
  };
  corruption: {
    permanent: number;
    temporary: number;
  };
  location?: string;
  traits: LearnedTrait[];
  rituals: LearnedRitual[];
  talents: LearnedTalent[];
  traditions: string[];
  /** Manual / persistent overrides authored by player or DM. Lifecycle is
   *  sibling-app-owned; the engine treats every entry as permanent. */
  effects: RawEffect[];
  affiliations: Affiliation[];
  background: CharacterBackground;
  equipment: CharacterEquipment;
  portrait: CharacterPortrait;
  // ── Server-derived (ADR-014) ────────────────────────────────────
  /** Active boolean flags written by the `flag` phase of recalc. */
  flags: string[];
  /** Trigger === "manual" actions. Derived; never accept from input. */
  specialAttacks: SpecialAttack[];
  /** Trigger !== "manual" actions. Derived; never accept from input. */
  reactions: Reaction[];
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}
