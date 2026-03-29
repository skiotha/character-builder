// function createDefaultCharacter(
//   playerId,
//   characterName,
//   playerName = "Unknown",
// ) {
//   return {

const rpgValidators = {
  attributePointsValid: () => true,

  currentHealthValid: () => true,

  defenseValid: () => true,

  painThresholdValid: () => true,

  corruptionThresholdValid: () => true,
};

const capitalize = (value) => value;

const getAttributeOrder = (name) => 1;

export const CHARACTER_SCHEMA = {
  _config: {
    maxAttributesTotal: 80,
    defaultAttributes: 5,
  },

  id: {
    type: "string",
    required: true,
    serverControlled: true,
    generated: true,
    permissions: { owner: false, dm: true, public: false },
  },

  backupCode: {
    type: "string",
    serverControlled: true,
    generated: true,
    permissions: { owner: true, dm: true, public: false },
  },

  created: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: { owner: false, dm: true, public: false },
  },

  lastModified: {
    type: "string",
    generated: true,
    serverControlled: true,
    permissions: { owner: false, dm: true, public: false },
  },

  player: {
    type: "string",
    generated: true,
    permissions: { owner: true, dm: true, public: false },
  },

  characterName: {
    type: "string",
    required: true,
    minLength: 3,
    maxLength: 16,
    pattern: /^[A-Za-z\s\-']+$/,
    sanitize: "trim",
    error: "Character names must be 3-16 letters and spaces only",
    permissions: { owner: true, dm: true, public: false },
    ui: { label: "Character Name", placeholder: "Enter character name" },
  },

  playerId: {
    type: "string",
    // required: true,
    immutable: true,
    serverControlled: true,
    permissions: { owner: true, dm: true, public: false },
  },

  attributes: {
    type: "object",
    required: true,
    permissions: { owner: true, dm: true, public: false },
    validate: rpgValidators.attributePointsValid,
    error: "Cannot exceed the attributes assign budget of 80",

    primary: {
      type: "object",
      required: true,
      permissions: { owner: true, dm: true, public: false },

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
      permissions: { owner: true, dm: true, public: false },

      toughness: {
        type: "object",
        permissions: { owner: true, dm: true, public: false },

        max: {
          type: "number",
          min: 10,
          integer: true,
          required: true,
          default: 10,
          derived: true,
          permissions: { owner: true, dm: true, public: false },
          error: "Max toughness can't be lower than 10",
        },

        current: {
          type: "number",
          min: 0,
          integer: true,
          required: true,
          derived: true,
          validate: rpgValidators.currentHealthValid,
          permissions: { owner: true, dm: true, public: false },
          error: "Current health must be between 0 and maximum health",
          ui: { quickActions: ["heal", "damage "] },
        },
      },

      defense: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.defenseValid,
        permissions: { owner: true, dm: true, public: false },
        error: "Defense value is incorrect for this character",
      },

      painThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.painThresholdValid,
        permissions: { owner: true, dm: true, public: false },
        error: "Pain threshold is incorrect for this character",
      },

      corruptionThreshold: {
        type: "number",
        required: true,
        derived: true,
        validate: rpgValidators.corruptionThresholdValid,
        permissions: { owner: true, dm: true, public: false },
        error: "Corruption threshold is incorrect for this character",
      },
    },
  },

  experience: {
    type: "object",
    permissions: { owner: true, dm: true, public: false },

    total: {
      type: "number",
      min: 50,
      integer: true,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Experience cannot be negative",
      ui: { label: "Total XP", help: "Total experience earned " },
    },

    unspent: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Experience cannot be negative",
      ui: { label: "Unspent XP", help: "Experience available to spend" },
    },
  },

  corruption: {
    type: "object",
    permissions: { owner: true, dm: true, public: false },

    permanent: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Permanent corruption can't be negative",
    },

    temporary: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Temporary corruption can't be negative",
    },
  },

  location: {
    type: "string",
    permissions: { owner: true, dm: true, public: false },
    error: "Location must be a string",
  },

  traits: {
    type: "array",
    permissions: { owner: true, dm: true, public: false },
  },
  effects: {
    type: "array",
    permissions: { owner: true, dm: true, public: false },
  },

  tradition: {
    type: "string",
    permissions: { owner: true, dm: true, public: false },
    error: "Mystical tradition needs to be a string",
  },

  assets: {
    type: "array",
    permissions: { owner: true, dm: true, public: false },
  },

  background: {
    type: "object",
    permissions: { owner: true, dm: true, public: false },

    age: {
      type: "number",
      min: 0,
      integer: true,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Age must be a positive number",
      ui: { label: "Age" },
    },

    race: {
      type: "string",
      required: true,
      sanitize: "trim",
      permissions: { owner: true, dm: true, public: false },
      error: "Race must be a string",
      ui: { label: "Race", placeholder: "Elf" },
    },

    shadow: {
      type: "string",
      permissions: { owner: true, dm: true, public: false },
      error: "Shadow description must be a string",
    },

    profession: {
      type: "string",
      permissions: { owner: true, dm: true, public: false },
      error: "Profession description must be a string",
    },

    journal: {
      type: "object",
      permissions: { owner: true, dm: true, public: false },

      open: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },

      done: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },

      rumours: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },
    },

    notes: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
    },

    kinkList: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
      error: "Invalid kink format",
      ui: { hidden: true },
    },
  },

  equipment: {
    type: "object",
    permissions: { owner: true, dm: true, public: false },

    money: {
      type: "number",
      min: 0,
      integer: false,
      required: true,
      permissions: { owner: true, dm: true, public: false },
      error: "Money count must be a positive number",
    },

    weapons: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
    },

    ammunition: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
    },

    armor: {
      type: "object",
      permissions: { owner: true, dm: true, public: false },

      body: {
        type: "object",
        permissions: { owner: true, dm: true, public: false },
      },

      plug: {
        type: "object",
        permissions: { owner: true, dm: true, public: false },
      },
    },

    runes: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
    },

    professional: {
      type: "object",
      permissions: { owner: true, dm: true, public: false },

      assassin: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },

      utility: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },
    },

    inventory: {
      type: "object",
      permissions: { owner: true, dm: true, public: false },

      self: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },

      home: {
        type: "array",
        permissions: { owner: true, dm: true, public: false },
      },
    },

    artifacts: {
      type: "array",
      permissions: { owner: true, dm: true, public: false },
    },
  },

  portrait: {
    type: "object",
    permissions: { owner: true, dm: true, public: false },

    path: {
      type: "string",
      serverControlled: true,
      // pattern: /^[A-Za-z\s\-']+$/,
      error: "Portrait path should be <pattern>",
      permissions: { owner: true, dm: true, public: false },
    },

    crop: {
      x: {
        type: "number",
        integer: false,
        permissions: { owner: true, dm: true, public: false },
        error: "Horizontal offset must be a float number",
      },

      y: {
        type: "number",
        integer: false,
        permissions: { owner: true, dm: true, public: false },
        error: "Vertical offset must be a float number",
      },

      scale: {
        type: "number",
        integer: false,
        min: 0.0,
        permissions: { owner: true, dm: true, public: false },
        error: "Scale factor must be a positive float number",
      },

      rotation: {
        type: "number",
        integer: false,
        permissions: { owner: true, dm: true, public: false },
        error: "Rotation degree must be a float number",
      },
    },

    dimensions: {
      type: "object",
      permissions: { owner: true, dm: true, public: false },

      width: {
        type: "number",
        min: 0,
        integer: true,
        permissions: { owner: true, dm: true, public: false },
        error: "Portrait width can't be negative",
      },

      height: {
        type: "number",
        min: 0,
        integer: true,
        permissions: { owner: true, dm: true, public: false },
        error: "Portrait height can't be negative",
      },
    },

    status: {
      type: "string",
      permissions: { owner: false, dm: true, public: false },
      error: "Portrait status needs to be one of three possible string values",
    },
  },
};

function createAttributeField(name) {
  return {
    type: "number",
    min: 5,
    max: 15,
    integer: true,
    default: 5,
    permissions: { owner: false, dm: true, public: false },
    error: `${capitalize(name)} must be between 5 and 15`,
    ui: { label: capitalize(name), order: getAttributeOrder(name) },
  };
}
