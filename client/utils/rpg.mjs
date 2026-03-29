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
    },
  },

  traits: [],
  tradition: "",

  equipment: {
    money: 5,
    weapons: [],
    ammunition: [],
    armor: {
      body: [],
      plug: [],
    },
    runes: [],
    professional: {
      assassin: [],
      utility: [],
    },
    inventory: {
      self: [],
      home: [],
    },
    artifacts: [],
  },

  assets: [],

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
  toughness: {
    dependsOn: "strong",
    calculate: (primaryValue) => Math.max(primaryValue || 0, 10),
  },
  pain: {
    dependsOn: "strong",
    calculate: (primaryValue) => Math.ceil((primaryValue || 0) * 0.5),
  },
  corruption: {
    dependsOn: "resolute",
    calculate: (primaryValue) => Math.ceil((primaryValue || 0) * 0.5),
  },
  defense: {
    dependsOn: "quick",
    calculate: (primaryValue) => primaryValue || 0,
  },
};

const PRIMARY_TO_SECONDARY = {
  strong: ["toughness", "pain"],
  resolute: ["corruption"],
  quick: ["defense"],
};

export {
  SECONDARY_ATTRIBUTES_RULES,
  PRIMARY_TO_SECONDARY,
  DEFAULT_CHARACTER,
  MAX_EXP,
};
