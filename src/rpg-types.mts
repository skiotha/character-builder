// ── Primary & Secondary Attributes ───────────────────────────────

export interface PrimaryAttributes {
  accurate: number;
  cunning: number;
  discreet: number;
  alluring: number;
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
  primary: PrimaryAttributes;
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

export type CombatSlotField =
  | "attackAttribute"
  | "baseDamage"
  | "bonusDamage"
  | "qualities"
  | "flags";

export type EffectFlag =
  | "poisonImmunity"
  | "diseaseImmunity"
  | "darkvision"
  | "infravision"
  | "trueSight"
  | "flight"
  | "swim"
  | "climb"
  | "undead"
  | "abomination";
// NOTE: This is a placeholder starting set. The authoring pass in Chunk F
// will surface the real vocabulary; this enum is expected to expand.

export type EffectTarget =
  | { kind: "secondary"; stat: SecondaryAttributeName }
  | { kind: "combat"; field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality"; quality: string }
  | { kind: "flag"; name: EffectFlag };

export type WeaponPredicate =
  | { kind: "any" }
  | { kind: "type"; values: string[] }
  | { kind: "quality"; values: string[] }
  | { kind: "id"; values: string[] };

export type EffectModifier =
  | { type: "setBase"; value: PrimaryAttributeName }
  | { type: "addFlat"; value: number }
  | { type: "multiply"; value: number }
  | { type: "cap"; value: number }
  | { type: "remove" };

export type EffectPhase =
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
  source: string;
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
// Slot 0 = primary, slot 1 = secondary, slot 2 = non-disarmable (`own`
// quality, required, never null). Slots 0/1 may be null when empty.
//
// All `CombatSlot` fields are server-derived. The combat phase is stubbed
// in Chunk C; per-slot fanout and weapon predicates land in Chunk E.

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

export interface Weapon {
  name?: string;
  type?: string;
  subtype?: string;
  damage?: number;
  qualities?: string[];
  // TODO(phase6-chunk-E): equipment effects flow through normalizeRawEffect
  // when the per-slot combat fanout lands. Inert in Chunk C.
  effects?: RawEffect[];
}

export interface ArmorPiece {
  name?: string;
  /** @deprecated TODO(phase6-chunk-D) — renamed to `armor`. */
  defense?: number;
  armor?: number;
  qualities?: string[];
  // TODO(phase6-chunk-E): armor-quality effects flow through the engine
  // when the per-slot combat fanout lands.
  [key: string]: unknown;
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
