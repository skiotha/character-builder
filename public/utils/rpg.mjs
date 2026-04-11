const MAX_EXP = 80;

const DEFAULT_CHARACTER = {
  characterName: "",
  playerId: null,

  portrait: {
    path: "",
    crop: {
      x: 0.0,
      y: 0.0,
      scale: 1.0,
      rotation: 0,
    },
    dimensions: {
      width: 0,
      height: 0,
    },
    status: "unset",
  },

  experience: { total: 50, unspent: 50 },
  corruption: { permanent: 0, temporary: 0 },

  attributes: {
    primary: {
      accurate: 5,
      cunning: 5,
      discreet: 5,
      alluring: 5,
      quick: 5,
      resolute: 5,
      vigilant: 5,
      strong: 5,
    },
    secondary: {
      toughness: { max: 10, current: 10 },
      painThreshold: 5,
      corruptionThreshold: 5,
      defense: 5,
      armor: 0,
      corruptionMax: 10,
    },
  },

  traits: [],
  rituals: [],
  talents: [],
  traditions: [],

  equipment: {
    money: 5,
    weapons: [],
    ammunition: [],
    armor: {
      body: null,
      plug: null,
    },
    runes: [],
    assassin: [],
    tools: [],
    inventory: {
      carried: [],
      home: [],
    },
    artifacts: [],
  },

  affiliations: [],

  combat: {
    attackAttribute: "accurate",
    baseDamage: 0,
    bonusDamage: [],
    weapons: [],
  },

  schemaVersion: 1,

  location: "Nagara",

  background: {
    race: "",
    shadow: "",
    age: 0,
    profession: "",
    kinkList: [],
    journal: {
      open: [],
      done: [],
      rumours: [],
    },
    notes: [],
  },
};

const SECONDARY_ATTRIBUTES_RULES = {
  "toughness.max": {
    dependsOn: "strong",
    calculate: (primaryValue) => Math.max(primaryValue || 0, 10),
  },
  "toughness.current": {
    dependsOn: "strong",
    calculate: (primaryValue) => Math.max(primaryValue || 0, 10),
  },
  painThreshold: {
    dependsOn: "strong",
    calculate: (primaryValue) => Math.ceil((primaryValue || 0) * 0.5),
  },
  corruptionThreshold: {
    dependsOn: "resolute",
    calculate: (primaryValue) => Math.ceil((primaryValue || 0) * 0.5),
  },
  defense: {
    dependsOn: "quick",
    calculate: (primaryValue) => primaryValue || 0,
  },
};

const PRIMARY_TO_SECONDARY = {
  strong: ["toughness.max", "toughness.current", "painThreshold"],
  resolute: ["corruptionThreshold"],
  quick: ["defense"],
};

export {
  SECONDARY_ATTRIBUTES_RULES,
  PRIMARY_TO_SECONDARY,
  DEFAULT_CHARACTER,
  MAX_EXP,
};
