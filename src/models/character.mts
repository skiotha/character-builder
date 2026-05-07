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

// ── Combat carried-tuple validator (ADR-014) ─────────────────────
//
// Enforces the 3-slot shape on input. The only writable inner field is
// `weaponIndex`; everything else is recalc output and any other key in
// the slot object is rejected. Slot 2 is required and must point at a
// weapon that has the `own` quality (the `natural_weapon` seed satisfies
// this by default — see deriveCombat in src/rules/derived.mts).
function validateCombatCarried(
  value: unknown,
  allData: Record<string, unknown>,
): true | string {
  if (!Array.isArray(value) || value.length !== 3) {
    return "combat.carried must be a 3-element array";
  }

  const equipment = allData?.equipment as { weapons?: unknown[] } | undefined;
  const weapons = Array.isArray(equipment?.weapons) ? equipment!.weapons : [];

  for (let i = 0; i < 3; i++) {
    const slot = value[i];

    if (slot === null) {
      if (i === 2) return "combat.carried[2] is required (own-weapon slot)";
      continue;
    }

    if (typeof slot !== "object" || Array.isArray(slot)) {
      return `combat.carried[${i}] must be null or { weaponIndex: number }`;
    }

    const keys = Object.keys(slot as Record<string, unknown>);
    if (keys.length !== 1 || keys[0] !== "weaponIndex") {
      return `combat.carried[${i}] only accepts the "weaponIndex" key`;
    }

    const weaponIndex = (slot as { weaponIndex: unknown }).weaponIndex;
    if (
      typeof weaponIndex !== "number" ||
      !Number.isInteger(weaponIndex) ||
      weaponIndex < 0 ||
      weaponIndex >= weapons.length
    ) {
      return `combat.carried[${i}].weaponIndex out of range`;
    }

    if (i === 2) {
      const weapon = weapons[weaponIndex] as
        | { qualities?: unknown[] }
        | undefined;
      const qualities = Array.isArray(weapon?.qualities)
        ? (weapon!.qualities as unknown[])
        : [];
      if (!qualities.includes("own")) {
        return "combat.carried[2] must reference a weapon with the `own` quality";
      }
    }
  }

  return true;
}

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const PRIMARY_ATTRIBUTE_ORDER: Record<string, number> = {
  accurate: 1,
  cunning: 2,
  discreet: 3,
  appealing: 4,
  quick: 5,
  resolute: 6,
  vigilant: 7,
  strong: 8,
};

const getAttributeOrder = (name: string): number =>
  PRIMARY_ATTRIBUTE_ORDER[name] ?? 99;

// ── Section Registry ───────────────────────────────────────────

export const SCHEMA_SECTIONS: SchemaSection[] = [
  // ── Parents (6) ─────────────────────────────────────────────
  { id: "attributes", label: "Attributes", order: 1 },
  { id: "talents", label: "Talents", order: 2 },
  { id: "portrait", label: "Portrait", order: 3 },
  { id: "experience", label: "Experience", order: 4 },
  { id: "traits", label: "Traits", order: 5 },
  { id: "information", label: "Information", order: 6 },

  // ── Children of attributes ──────────────────────────────────
  {
    id: "attributes.primary",
    label: "Primary",
    order: 1,
    parent: "attributes",
    displayId: "primary",
  },
  {
    id: "attributes.secondary",
    label: "Secondary",
    order: 2,
    parent: "attributes",
    displayId: "secondary",
  },

  // ── Children of information ─────────────────────────────────
  {
    id: "information.personal",
    label: "",
    order: 1,
    parent: "information",
    displayId: "personal",
  },
  {
    id: "information.equipment",
    label: "",
    order: 2,
    parent: "information",
    displayId: "equipment",
  },
  {
    id: "information.corruption",
    label: "Corruption",
    order: 3,
    parent: "information",
    displayId: "corruption",
  },
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
    default: 2,
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
      component: "character-name",
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
      appealing: createAttributeField("appealing"),
      quick: createAttributeField("quick"),
      resolute: createAttributeField("resolute"),
      vigilant: createAttributeField("vigilant"),
      strong: createAttributeField("strong"),
    },

    // Recalc-output snapshot of `primary` after `kind: "primary"` effects
    // (addFlat, cap) are applied. Server-controlled — clients receive it for
    // display but cannot write it. May exceed the 5–15 base range.
    primaryEffective: {
      type: "object",
      required: true,
      derived: true,
      serverControlled: true,
      permissions: perm_attr,

      accurate: createEffectiveAttributeField("accurate"),
      cunning: createEffectiveAttributeField("cunning"),
      discreet: createEffectiveAttributeField("discreet"),
      appealing: createEffectiveAttributeField("appealing"),
      quick: createEffectiveAttributeField("quick"),
      resolute: createEffectiveAttributeField("resolute"),
      vigilant: createEffectiveAttributeField("vigilant"),
      strong: createEffectiveAttributeField("strong"),
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
            displayAs: "readonly",
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

  // ── Combat (ADR-014: per-slot) ──────────────────────────────
  //
  // The 3-slot `carried` tuple is the ONLY writable combat surface.
  // Per-slot derived fields (`attackAttribute`, `baseDamage`, `bonusDamage`,
  // `qualities`, `flags`) plus top-level `specialAttacks` and `reactions`
  // are pure recalc output — not registered in the schema, not validated
  // on input, sanitizer (denylist) lets them through.

  combat: {
    type: "object",
    permissions: perm_default,

    carried: {
      type: "array",
      permissions: perm_default,
      default: [null, null, { weaponIndex: 0 }],
      validate: validateCombatCarried,
      ui: {
        section: "information.equipment",
        label: "Carried Weapons",
        order: 11,
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
        hidden: true,
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
        section: "information.corruption",
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
        section: "information.corruption",
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
      section: "information.personal",
      label: "Location",
      order: 10,
      displayAs: "input",
    },
  },

  // ── Learned Traits & Talents ─────────────────────────────────

  traits: {
    type: "array",
    permissions: perm_default,
    ui: {
      section: "traits",
      label: "Traits",
      component: "trait-list",
    },
  },

  rituals: {
    type: "array",
    permissions: perm_default,
    ui: {
      hidden: true,
    },
  },

  talents: {
    type: "array",
    permissions: perm_private,
    ui: {
      section: "talents",
      label: "Talents",
      component: "talent-list",
    },
  },

  traditions: {
    type: "array",
    permissions: perm_default,
    error: "Traditions must be an array of tradition IDs",
    ui: {
      hidden: true,
    },
  },

  effects: {
    type: "array",
    permissions: perm_dm_write,
    ui: { hidden: true },
  },

  // ── Affiliations ────────────────────────────────────────────

  affiliations: {
    type: "array",
    permissions: perm_default,
    ui: {
      hidden: true,
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
        section: "information.personal",
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
        section: "information.personal",
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
        hidden: true,
      },
    },

    profession: {
      type: "string",
      permissions: perm_default,
      error: "Profession description must be a string",
      ui: {
        section: "information.personal",
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
        hidden: true,
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
        section: "information.personal",
        label: "Reales",
        placeholder: "5",
        order: 5,
        displayAs: "number",
      },
    },

    weapons: {
      type: "array",
      permissions: perm_default,
      // ADR-014: index 0 is the synthetic natural-weapon anchor for slot 2.
      default: [
        {
          id: "natural_weapon",
          name: "natural_weapon",
          type: "natural",
          damage: 0,
          qualities: ["own"],
        },
      ],
      ui: {
        section: "information.equipment",
        label: "Weapons",
        order: 1,
        component: "equipment-list",
      },
    },

    ammunition: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "information.equipment",
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
          section: "information.equipment",
          label: "Body Armor",
          order: 3,
          component: "armor-slot",
        },
      },

      plug: {
        type: "object",
        permissions: perm_default,
        ui: {
          section: "information.equipment",
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
        section: "information.equipment",
        label: "Runes",
        order: 5,
        component: "equipment-list",
      },
    },

    assassin: {
      type: "array",
      permissions: perm_private,
      ui: {
        section: "information.equipment",
        label: "Assassin Tools",
        order: 6,
        component: "equipment-list",
      },
    },

    tools: {
      type: "array",
      permissions: perm_default,
      ui: {
        section: "information.equipment",
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
          section: "information.equipment",
          label: "Carried Items",
          order: 8,
          component: "equipment-list",
        },
      },

      home: {
        type: "array",
        permissions: perm_private,
        ui: {
          section: "information.equipment",
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
        section: "information.equipment",
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

function createEffectiveAttributeField(name: string): SchemaField {
  return {
    type: "number",
    integer: true,
    derived: true,
    serverControlled: true,
    default: 5,
    permissions: perm_attr,
    ui: {
      section: "attributes.primary",
      label: `${capitalize(name)} (effective)`,
      order: getAttributeOrder(name) + 100,
      displayAs: "readonly",
    },
  };
}
