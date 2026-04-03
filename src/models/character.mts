// function createDefaultCharacter(
//   playerId,
//   characterName,
//   playerName = "Unknown",
// ) {
//   return {

import type { SchemaField } from "#types";

const rpgValidators = {
  attributePointsValid: (): boolean => true,

  currentHealthValid: (): boolean => true,

  defenseValid: (): boolean => true,

  painThresholdValid: (): boolean => true,

  corruptionThresholdValid: (): boolean => true,
};

const capitalize = (value: string): string => value;

const getAttributeOrder = (name: string): number => 1;

// ── Permission shorthands ──────────────────────────────────────

const RW = { read: true, write: true };
const RO = { read: true, write: false };
const NO = { read: false, write: false };

/** Owner + DM read/write, public read-only */
const perm_default = { owner: RW, dm: RW, public: RO };

/** Owner + DM read/write, public hidden */
const perm_private = { owner: RW, dm: RW, public: NO };

/** DM read/write only, owner + public read-only */
const perm_dm_write = { owner: RO, dm: RW, public: RO };

/** Server-controlled: everyone read-only (DM can read) */
const perm_server = { owner: RO, dm: RO, public: NO };

/** Attributes: owner read-only (values shown), DM read/write */
const perm_attr = { owner: RO, dm: RW, public: RO };

export const CHARACTER_SCHEMA: Record<
  string,
  SchemaField | Record<string, unknown>
> = {
  _config: {
    maxAttributesTotal: 80,
    defaultAttributes: 5,
  },

  id: {
    type: "string",
    required: true,
    serverControlled: true,
    generated: true,
    permissions: perm_server,
  },

  backupCode: {
    type: "string",
    serverControlled: true,
    generated: true,
    permissions: { owner: RO, dm: RO, public: NO },
  },

  schemaVersion: {
    type: "number",
    required: true,
    serverControlled: true,
    generated: true,
    default: 1,
    permissions: perm_server,
  },

  created: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: perm_server,
  },

  lastModified: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: perm_server,
  },

  player: {
    type: "string",
    generated: true,
    permissions: perm_private,
  },

  characterName: {
    type: "string",
    required: true,
    minLength: 3,
    maxLength: 16,
    pattern: /^[A-Za-z\s\-']+$/,
    sanitize: "trim",
    error: "Character names must be 3-16 letters and spaces only",
    permissions: perm_default,
    ui: { label: "Character Name", placeholder: "Enter character name" },
  },

  playerId: {
    type: "string",
    immutable: true,
    serverControlled: true,
    permissions: { owner: RO, dm: RO, public: NO },
  },

  // ── Attributes ──────────────────────────────────────────────

  attributes: {
    type: "object",
    required: true,
    permissions: perm_default,
    validate: rpgValidators.attributePointsValid,
    error: "Cannot exceed the attributes assign budget of 80",

    primary: {
      type: "object",
      required: true,
      permissions: perm_default,

      accurate: createAttributeField("accurate"),
      cunning: createAttributeField("cunning"),
      discreet: createAttributeField("discreet"),
      alluring: createAttributeField("alluring"),
      quick: createAttributeField("quick"),
      resolute: createAttributeField("resolute"),
      vigilant: createAttributeField("vigilant"),
      strong: createAttributeField("strong"),
    },

    secondary: {
      type: "object",
      required: true,
      permissions: perm_default,

      toughness: {
        type: "object",
        permissions: perm_default,

        max: {
          type: "number",
          min: 10,
          integer: true,
          required: true,
          default: 10,
          derived: true,
          permissions: perm_default,
          error: "Max toughness can't be lower than 10",
        },

        current: {
          type: "number",
          min: 0,
          integer: true,
          required: true,
          derived: true,
          validate: rpgValidators.currentHealthValid,
          permissions: perm_default,
          error: "Current health must be between 0 and maximum health",
          ui: { quickActions: ["heal", "damage"] },
        },
      },

      defense: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.defenseValid,
        permissions: perm_default,
        error: "Defense value is incorrect for this character",
      },

      armor: {
        type: "number",
        required: true,
        default: 0,
        derived: true,
        permissions: perm_default,
        error: "Armor value is incorrect for this character",
      },

      painThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.painThresholdValid,
        permissions: perm_default,
        error: "Pain threshold is incorrect for this character",
      },

      corruptionThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.corruptionThresholdValid,
        permissions: perm_default,
        error: "Corruption threshold is incorrect for this character",
      },

      corruptionMax: {
        type: "number",
        required: true,
        derived: true,
        permissions: perm_default,
        error: "Corruption max is incorrect for this character",
      },
    },
  },

  // ── Combat ──────────────────────────────────────────────────

  combat: {
    type: "object",
    derived: true,
    permissions: perm_default,

    attackAttribute: {
      type: "string",
      derived: true,
      default: "accurate",
      permissions: perm_default,
    },

    baseDamage: {
      type: "number",
      derived: true,
      default: 0,
      permissions: perm_default,
    },

    bonusDamage: {
      type: "array",
      derived: true,
      permissions: perm_default,
    },

    weapons: {
      type: "array",
      permissions: perm_default,
    },
  },

  // ── Progression ─────────────────────────────────────────────

  experience: {
    type: "object",
    permissions: perm_default,

    total: {
      type: "number",
      min: 50,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Experience cannot be negative",
      ui: { label: "Total XP", help: "Total experience earned" },
    },

    unspent: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Experience cannot be negative",
      ui: { label: "Unspent XP", help: "Experience available to spend" },
    },
  },

  corruption: {
    type: "object",
    permissions: perm_default,

    permanent: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Permanent corruption can't be negative",
    },

    temporary: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Temporary corruption can't be negative",
    },
  },

  location: {
    type: "string",
    permissions: perm_default,
    error: "Location must be a string",
  },

  // ── Learned Abilities & Spells ──────────────────────────────

  abilities: {
    type: "array",
    permissions: perm_default,
  },

  spells: {
    type: "array",
    permissions: perm_default,
  },

  rituals: {
    type: "array",
    permissions: perm_default,
  },

  boons: {
    type: "array",
    permissions: perm_default,
  },

  sins: {
    type: "array",
    permissions: perm_private,
  },

  traditions: {
    type: "array",
    permissions: perm_default,
    error: "Traditions must be an array of tradition IDs",
  },

  effects: {
    type: "array",
    permissions: perm_dm_write,
  },

  // ── Affiliations ────────────────────────────────────────────

  affiliations: {
    type: "array",
    permissions: perm_default,
  },

  // ── Background ──────────────────────────────────────────────

  background: {
    type: "object",
    permissions: perm_default,

    age: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Age must be a positive number",
      ui: { label: "Age" },
    },

    race: {
      type: "string",
      required: true,
      sanitize: "trim",
      permissions: perm_default,
      error: "Race must be a string",
      ui: { label: "Race", placeholder: "Elf" },
    },

    shadow: {
      type: "string",
      permissions: perm_default,
      error: "Shadow description must be a string",
    },

    profession: {
      type: "string",
      permissions: perm_default,
      error: "Profession description must be a string",
    },

    journal: {
      type: "object",
      permissions: perm_private,

      open: {
        type: "array",
        permissions: perm_private,
      },

      done: {
        type: "array",
        permissions: perm_private,
      },

      rumours: {
        type: "array",
        permissions: perm_private,
      },
    },

    notes: {
      type: "array",
      permissions: perm_private,
    },

    kinkList: {
      type: "array",
      permissions: perm_private,
      error: "Invalid kink format",
      ui: { hidden: true },
    },
  },

  // ── Equipment ───────────────────────────────────────────────

  equipment: {
    type: "object",
    permissions: perm_default,

    money: {
      type: "number",
      min: 0,
      integer: false,
      required: true,
      permissions: perm_default,
      error: "Money count must be a positive number",
    },

    weapons: {
      type: "array",
      permissions: perm_default,
    },

    ammunition: {
      type: "array",
      permissions: perm_default,
    },

    armor: {
      type: "object",
      permissions: perm_default,

      body: {
        type: "object",
        permissions: perm_default,
      },

      plug: {
        type: "object",
        permissions: perm_default,
      },
    },

    runes: {
      type: "array",
      max: 3,
      permissions: perm_default,
    },

    assassin: {
      type: "array",
      permissions: perm_private,
    },

    tools: {
      type: "array",
      permissions: perm_default,
    },

    inventory: {
      type: "object",
      permissions: perm_default,

      carried: {
        type: "array",
        permissions: perm_default,
      },

      home: {
        type: "array",
        permissions: perm_private,
      },
    },

    artifacts: {
      type: "array",
      permissions: perm_default,
    },
  },

  // ── Portrait ────────────────────────────────────────────────

  portrait: {
    type: "object",
    permissions: perm_default,

    path: {
      type: "string",
      serverControlled: true,
      error: "Portrait path should be <pattern>",
      permissions: { owner: RO, dm: RO, public: RO },
    },

    crop: {
      x: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Horizontal offset must be a float number",
      },

      y: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Vertical offset must be a float number",
      },

      scale: {
        type: "number",
        integer: false,
        min: 0.0,
        permissions: perm_default,
        error: "Scale factor must be a positive float number",
      },

      rotation: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Rotation degree must be a float number",
      },
    },

    dimensions: {
      type: "object",
      permissions: perm_default,

      width: {
        type: "number",
        min: 0,
        integer: true,
        permissions: perm_default,
        error: "Portrait width can't be negative",
      },

      height: {
        type: "number",
        min: 0,
        integer: true,
        permissions: perm_default,
        error: "Portrait height can't be negative",
      },
    },

    status: {
      type: "string",
      serverControlled: true,
      permissions: { owner: RO, dm: RO, public: RO },
      error: "Portrait status needs to be one of three possible string values",
    },
  },
};

function createAttributeField(name: string): SchemaField {
  return {
    type: "number",
    min: 5,
    max: 15,
    integer: true,
    default: 5,
    permissions: perm_attr,
    error: `${capitalize(name)} must be between 5 and 15`,
    ui: { label: capitalize(name), order: getAttributeOrder(name) },
  };
}
