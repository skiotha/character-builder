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

// ── Effects ───────────────────────────────────────────────────────

export interface EffectModifier {
  type: string;
  value: number;
}

export interface Effect {
  id?: string;
  source?: string;
  name?: string;
  description?: string;
  target: string;
  modifier: EffectModifier;
  priority?: number;
  duration?: string | null;
}

// ── Learned Abilities, Spells & Progression ──────────────────────

export type AbilityTier = "novice" | "adept" | "master";

export interface LearnedAbility {
  id: string;
  tier: AbilityTier;
}

export interface LearnedSpell {
  id: string;
  tier: AbilityTier;
}

export interface LearnedRitual {
  id: string;
  level: number;
}

export interface LearnedBoon {
  id: string;
  level: number;
}

export interface LearnedSin {
  id: string;
  level: number;
}

// ── Combat ────────────────────────────────────────────────────────

export interface Combat {
  attackAttribute: PrimaryAttributeName;
  baseDamage: number;
  bonusDamage: number[];
  weapons: number[];
}

// ── Equipment ─────────────────────────────────────────────────────

export interface Weapon {
  name?: string;
  type?: string;
  subtype?: string;
  damage?: number;
  qualities?: string[];
  effects?: Effect[];
}

export interface ArmorPiece {
  name?: string;
  defense?: number;
  qualities?: string[];
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
  abilities: LearnedAbility[];
  spells: LearnedSpell[];
  rituals: LearnedRitual[];
  boons: LearnedBoon[];
  sins: LearnedSin[];
  traditions: string[];
  effects: Effect[];
  affiliations: Affiliation[];
  background: CharacterBackground;
  equipment: CharacterEquipment;
  portrait: CharacterPortrait;
  deleted?: boolean;
  deletedAt?: string;
  deleteAt?: string;
  deletedBy?: string;
}
