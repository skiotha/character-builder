// function createDefaultCharacter(
//   playerId,
//   characterName,
//   playerName = "Unknown",
// ) {
//   return {

import type { SchemaField, SchemaSection } from "#types";

const rpgValidators = {
  attributePointsValid: (): boolean => true,

  currentHealthValid: (): boolean => true,

  defenseValid: (): boolean => true,

  painThresholdValid: (): boolean => true,

  corruptionThresholdValid: (): boolean => true,
};

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const PRIMARY_ATTRIBUTE_ORDER: Record<string, number> = {
  accurate: 1,
  cunning: 2,
  discreet: 3,
  alluring: 4,
  quick: 5,
  resolute: 6,
  vigilant: 7,
  strong: 8,
};

const getAttributeOrder = (name: string): number =>
  PRIMARY_ATTRIBUTE_ORDER[name] ?? 99;

// ── Section Registry ───────────────────────────────────────────

export const SCHEMA_SECTIONS: SchemaSection[] = [
  { id: "portrait", label: "Portrait", order: 1 },
  { id: "attributes.primary", label: "Primary Attributes", order: 2 },
  { id: "attributes.secondary", label: "Secondary Attributes", order: 3 },
  { id: "combat", label: "Combat", order: 4 },
  { id: "experience", label: "Experience", order: 5 },
  { id: "corruption", label: "Corruption", order: 6 },
  { id: "traits", label: "Traits", order: 7 },
  { id: "spells", label: "Spells", order: 8 },
  { id: "rituals", label: "Rituals", order: 9 },
  { id: "traditions", label: "Traditions", order: 10 },
  { id: "talents", label: "Talents", order: 11 },
  { id: "boons", label: "Boons", order: 12 },
  { id: "information", label: "Information", order: 13 },
  { id: "equipment", label: "Equipment", order: 14 },
  { id: "background", label: "Background", order: 15 },
];

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
    ui: { hidden: true },
  },

  backupCode: {
    type: "string",
    serverControlled: true,
    generated: true,
    permissions: { owner: RO, dm: RO, public: NO },
    ui: { hidden: true },
  },

  schemaVersion: {
    type: "number",
    required: true,
    serverControlled: true,
    generated: true,
    default: 1,
    permissions: perm_server,
    ui: { hidden: true },
  },

  created: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: perm_server,
    ui: { hidden: true },
  },

  lastModified: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: perm_server,
    ui: { hidden: true },
  },

  player: {
    type: "string",
    generated: true,
    permissions: perm_private,
    ui: { hidden: true },
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
    ui: {
      section: "information",
      label: "Character Name",
      placeholder: "Enter character name",
      order: 1,
      displayAs: "input",
    },
  },

  playerId: {
    type: "string",
    immutable: true,
    serverControlled: true,
    permissions: { owner: RO, dm: RO, public: NO },
    ui: { hidden: true },
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
          ui: {
            section: "attributes.secondary",
            label: "Toughness",
            placeholder: "10",
            order: 1,
            displayAs: "readonly",
          },
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
          ui: {
            section: "attributes.secondary",
            label: "Health",
            order: 2,
            displayAs: "number",
            quickActions: ["heal", "damage"],
          },
        },
      },

      defense: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.defenseValid,
        permissions: perm_default,
        error: "Defense value is incorrect for this character",
        ui: {
          section: "attributes.secondary",
          label: "Defense",
          placeholder: "10",
          order: 3,
          displayAs: "readonly",
        },
      },

      armor: {
        type: "number",
        required: true,
        default: 0,
        derived: true,
        permissions: perm_default,
        error: "Armor value is incorrect for this character",
        ui: {
          section: "attributes.secondary",
          label: "Armor",
          order: 4,
          displayAs: "readonly",
        },
      },

      painThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.painThresholdValid,
        permissions: perm_default,
        error: "Pain threshold is incorrect for this character",
        ui: {
          section: "attributes.secondary",
          label: "Pain Threshold",
          placeholder: "10",
          order: 5,
          displayAs: "readonly",
        },
      },

      corruptionThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.corruptionThresholdValid,
        permissions: perm_default,
        error: "Corruption threshold is incorrect for this character",
        ui: {
          section: "attributes.secondary",
          label: "Corruption Threshold",
          placeholder: "10",
          order: 6,
          displayAs: "readonly",
        },
      },

      corruptionMax: {
        type: "number",
        required: true,
        derived: true,
        permissions: perm_default,
        error: "Corruption max is incorrect for this character",
        ui: {
          section: "attributes.secondary",
          label: "Corruption Max",
          order: 7,
          displayAs: "readonly",
        },
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
      ui: {
        section: "combat",
        label: "Attack Attribute",
        order: 1,
        displayAs: "readonly",
      },
    },

    baseDamage: {
      type: "number",
      derived: true,
      default: 0,
      permissions: perm_default,
      ui: {
        section: "combat",
        label: "Base Damage",
        order: 2,
        displayAs: "readonly",
      },
    },

    bonusDamage: {
      type: "array",
      derived: true,
      permissions: perm_default,
      ui: {
        section: "combat",
        label: "Bonus Damage",
        order: 3,
        displayAs: "readonly",
      },
    },

    weapons: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "combat",
        label: "Weapon Slots",
        order: 4,
        component: "weapon-slots",
      },
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
      ui: {
        section: "experience",
        label: "Total XP",
        help: "Total experience earned",
        order: 1,
        displayAs: "number",
      },
    },

    unspent: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Experience cannot be negative",
      ui: {
        section: "experience",
        label: "Unspent XP",
        help: "Experience available to spend",
        order: 2,
        displayAs: "number",
      },
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
      ui: {
        section: "corruption",
        label: "Permanent",
        order: 1,
        displayAs: "number",
      },
    },

    temporary: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: perm_default,
      error: "Temporary corruption can't be negative",
      ui: {
        section: "corruption",
        label: "Temporary",
        order: 2,
        displayAs: "number",
      },
    },
  },

  location: {
    type: "string",
    permissions: perm_default,
    error: "Location must be a string",
    ui: {
      section: "information",
      label: "Location",
      order: 10,
      displayAs: "input",
    },
  },

  // ── Learned Abilities & Spells ──────────────────────────────

  abilities: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "traits",
      label: "Abilities",
      component: "ability-list",
    },
  },

  spells: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "traits",
      label: "Spells",
      component: "ability-list",
    },
  },

  rituals: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "rituals",
      label: "Rituals",
      component: "ritual-list",
    },
  },

  boons: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "talents",
      label: "Boons",
      component: "sin-list",
    },
  },

  sins: {
    type: "array",
    permissions: perm_private,
    ui: {
      section: "talents",
      label: "Sins",
      component: "sin-list",
    },
  },

  traditions: {
    type: "array",
    permissions: perm_default,
    error: "Traditions must be an array of tradition IDs",
    ui: {
      section: "traditions",
      label: "Traditions",
      component: "tradition-list",
    },
  },

  effects: {
    type: "array",
    permissions: perm_dm_write,
    ui: {
      section: "combat",
      label: "Active Effects",
      order: 5,
      component: "effect-list",
    },
  },

  // ── Affiliations ────────────────────────────────────────────

  affiliations: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "information",
      label: "Affiliations",
      order: 8,
      component: "affiliation-list",
    },
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
      ui: {
        section: "information",
        label: "Age",
        placeholder: "35",
        order: 2,
        displayAs: "number",
      },
    },

    race: {
      type: "string",
      required: true,
      sanitize: "trim",
      permissions: perm_default,
      error: "Race must be a string",
      ui: {
        section: "information",
        label: "Race",
        placeholder: "Elf",
        order: 3,
        displayAs: "input",
      },
    },

    shadow: {
      type: "string",
      permissions: perm_default,
      error: "Shadow description must be a string",
      ui: {
        section: "information",
        label: "Shadow",
        placeholder: "Describe shadow...",
        order: 6,
        displayAs: "textarea",
      },
    },

    profession: {
      type: "string",
      permissions: perm_default,
      error: "Profession description must be a string",
      ui: {
        section: "information",
        label: "Profession",
        placeholder: "Profession",
        order: 4,
        displayAs: "input",
      },
    },

    journal: {
      type: "object",
      permissions: perm_private,
      ui: { hidden: true },

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
      ui: {
        section: "background",
        label: "Notes",
        order: 1,
        component: "notes-list",
      },
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
      ui: {
        section: "information",
        label: "Reales",
        placeholder: "5",
        order: 5,
        displayAs: "number",
      },
    },

    weapons: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "equipment",
        label: "Weapons",
        order: 1,
        component: "equipment-list",
      },
    },

    ammunition: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "equipment",
        label: "Ammunition",
        order: 2,
        component: "equipment-list",
      },
    },

    armor: {
      type: "object",
      permissions: perm_default,

      body: {
        type: "object",
        permissions: perm_default,
        ui: {
          section: "equipment",
          label: "Body Armor",
          order: 3,
          component: "armor-slot",
        },
      },

      plug: {
        type: "object",
        permissions: perm_default,
        ui: {
          section: "equipment",
          label: "Plug Armor",
          order: 4,
          component: "armor-slot",
        },
      },
    },

    runes: {
      type: "array",
      max: 3,
      permissions: perm_default,
      ui: {
        section: "equipment",
        label: "Runes",
        order: 5,
        component: "equipment-list",
      },
    },

    assassin: {
      type: "array",
      permissions: perm_private,
      ui: {
        section: "equipment",
        label: "Assassin Tools",
        order: 6,
        component: "equipment-list",
      },
    },

    tools: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "equipment",
        label: "Tools",
        order: 7,
        component: "equipment-list",
      },
    },

    inventory: {
      type: "object",
      permissions: perm_default,

      carried: {
        type: "array",
        permissions: perm_default,
        ui: {
          section: "equipment",
          label: "Carried Items",
          order: 8,
          component: "equipment-list",
        },
      },

      home: {
        type: "array",
        permissions: perm_private,
        ui: {
          section: "equipment",
          label: "Home Storage",
          order: 9,
          component: "equipment-list",
        },
      },
    },

    artifacts: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "equipment",
        label: "Artifacts",
        order: 10,
        component: "equipment-list",
      },
    },
  },

  // ── Portrait ────────────────────────────────────────────────

  portrait: {
    type: "object",
    permissions: perm_default,
    ui: {
      section: "portrait",
      label: "Portrait",
      component: "portrait",
    },

    path: {
      type: "string",
      serverControlled: true,
      error: "Portrait path should be <pattern>",
      permissions: { owner: RO, dm: RO, public: RO },
      ui: { hidden: true },
    },

    crop: {
      x: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Horizontal offset must be a float number",
        ui: { hidden: true },
      },

      y: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Vertical offset must be a float number",
        ui: { hidden: true },
      },

      scale: {
        type: "number",
        integer: false,
        min: 0.0,
        permissions: perm_default,
        error: "Scale factor must be a positive float number",
        ui: { hidden: true },
      },

      rotation: {
        type: "number",
        integer: false,
        permissions: perm_default,
        error: "Rotation degree must be a float number",
        ui: { hidden: true },
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
        ui: { hidden: true },
      },

      height: {
        type: "number",
        min: 0,
        integer: true,
        permissions: perm_default,
        error: "Portrait height can't be negative",
        ui: { hidden: true },
      },
    },

    status: {
      type: "string",
      serverControlled: true,
      permissions: { owner: RO, dm: RO, public: RO },
      error: "Portrait status needs to be one of three possible string values",
      ui: { hidden: true },
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
    ui: {
      section: "attributes.primary",
      label: capitalize(name),
      placeholder: "5",
      order: getAttributeOrder(name),
      displayAs: "number",
    },
  };
}
