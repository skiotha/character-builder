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
  painThreshold: number;
  corruptionThreshold: number;
}

export interface CharacterAttributes {
  primary: PrimaryAttributes;
  secondary: SecondaryAttributes;
}

// ── Effects & Traits ──────────────────────────────────────────────

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

export interface Trait {
  name: string;
  type: string;
  description?: string;
  effects?: Effect[];
  cost?: number[];
}

// ── Equipment ─────────────────────────────────────────────────────

export interface Weapon {
  name?: string;
  damage?: string;
  effects?: Effect[];
}

export interface ArmorPiece {
  name?: string;
  defense?: number;
  [key: string]: unknown;
}

export interface CharacterEquipment {
  money: number;
  weapons: Weapon[];
  ammunition: unknown[];
  armor: {
    body: ArmorPiece | null;
    plug: ArmorPiece | null;
  };
  runes: unknown[];
  professional: {
    assassin: unknown[];
    utility: unknown[];
  };
  inventory: {
    self: unknown[];
    home: unknown[];
  };
  artifacts: unknown[];
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

// ── Character ─────────────────────────────────────────────────────

export interface Character {
  id: string;
  backupCode: string;
  playerId: string;
  player: string;
  characterName: string;
  created: string;
  lastModified: string;
  attributes: CharacterAttributes;
  experience: {
    total: number;
    unspent: number;
  };
  corruption: {
    permanent: number;
    temporary: number;
  };
  location?: string;
  traits: Trait[];
  effects: Effect[];
  tradition?: string;
  assets: unknown[];
  background: CharacterBackground;
  equipment: CharacterEquipment;
  portrait: CharacterPortrait;
  deleted?: boolean;
  deletedAt?: string;
  deleteAt?: string;
  deletedBy?: string;
}
