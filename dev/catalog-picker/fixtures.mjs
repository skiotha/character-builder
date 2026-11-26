/**
 * @typedef {object} CatalogFixture
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {string[]} [tiers]
 * @property {number} [levels]
 * @property {string} [tradition]
 * @property {string[]} [traditions]
 */

/** @type {CatalogFixture[]} */
const TRAIT_ENTRIES = [
  {
    id: "acrobatics",
    name: "Acrobatics",
    description:
      "Agility, maneuverability, and gymnastic techniques for movement in combat and bypassing opponents.",
    source: "ability",
    tags: ["mobility", "defense", "quick", "reaction"],
    tiers: ["novice", "adept", "master"],
  },
  {
    id: "street-fighting",
    name: "Street Fighting",
    description:
      "Rough and brutal melee techniques for stunning, knocking down, and countering opponents.",
    source: "ability",
    tags: ["melee", "status", "reaction", "piercing", "quick"],
    tiers: ["novice", "adept", "master"],
  },
  {
    id: "mystical-tradition-order",
    name: "Mystical Tradition: Order",
    description:
      "The academic Order tradition that lowers the cost of learning and using its own spells.",
    source: "ability",
    tags: ["magic", "tradition", "order", "resolute"],
    tradition: "order",
    tiers: ["novice", "adept", "master"],
  },
  {
    id: "mystical-tradition-witches-circle",
    name: "Mystical Tradition: Witches' Circle",
    description:
      "The wild witch tradition that reduces Corruption costs for its curses, natural magic, and rituals.",
    source: "ability",
    tags: ["magic", "tradition", "circle"],
    tradition: "circle",
    tiers: ["novice", "adept", "master"],
  },
  {
    id: "anathema",
    name: "Anathema",
    description:
      "Dispelling foreign magic and non-ritual supernatural effects.",
    source: "spell",
    tags: ["magic", "support", "runes", "theurgy", "circle", "resolute"],
    traditions: ["runes", "theurgy", "circle"],
    tiers: ["novice", "adept", "master"],
  },
];

/** @type {CatalogFixture[]} */
const TALENT_ENTRIES = [
  {
    id: "cartographer",
    name: "Cartographer",
    description:
      "Lets the character join expeditions and ship crews without paying passage, and also work as a navigator or guide. Grants a +1 bonus on all checks related to navigation at sea, on land, and in dungeons.",
    source: "boon",
    tags: ["boon", "profession", "knowledge", "support"],
    levels: 3,
  },
  {
    id: "contacts",
    name: "Contacts",
    description:
      "With a successful Appealing check, the character can recall an acquaintance able to help with a specific problem or pull them out of a difficult situation. If the character can get a message to them, that contact comes to help even from afar.",
    source: "boon",
    tags: ["boon", "appealing", "support"],
    levels: 1,
  },
  {
    id: "damage",
    name: "Damage",
    description:
      "After each removal of Corruption, the character cannot cast spells, though they can still use abilities, for a number of hours equal to the Corruption removed.",
    source: "sin",
    tags: ["sin", "corruption", "magic", "status"],
    levels: 1,
  },
  {
    id: "deceiver",
    name: "Deceiver",
    description:
      "Grants a +1 bonus on all Appealing and Vigilant checks related to lies, including spotting someone else’s lies.",
    source: "boon",
    tags: ["boon", "appealing", "vigilant", "knowledge"],
    levels: 3,
  },
  {
    id: "bloodthirst",
    name: "Bloodthirst",
    description:
      "If the character, their enemy, or someone nearby has taken damage, the character cannot spare an enemy even if that enemy surrenders. Resisting the effect requires 1 experience and an Vigilant check.",
    source: "sin",
    tags: ["sin", "status", "corruption"],
    levels: 1,
  },
];

/** @type {CatalogFixture[]} */
const RITUAL_ENTRIES = [
  {
    id: "rite-of-opening-and-sealing",
    name: "Rite of Opening and Rite of Sealing",
    description:
      "Opens any door, lock, or gate, or seals it mystically instead; opening something locked requires a Will check.",
    traditions: ["sirens"],
    tags: ["magic", "sirens", "support", "protection"],
  },
  {
    id: "telepathic-interrogation",
    name: "Telepathic Interrogation",
    description:
      "Allows the mystic to read a victim’s thoughts by touch and receive yes/no answers from their subconscious through Will checks; after a failure, the interrogation cannot be repeated until the end of the chapter.",
    traditions: ["order"],
    tags: ["magic", "order", "information"],
  },
];

/** @type {Record<"traits" | "talents" | "rituals", CatalogFixture[]>} */
const CATALOG_FIXTURES = {
  traits: TRAIT_ENTRIES,
  talents: TALENT_ENTRIES,
  rituals: RITUAL_ENTRIES,
};

/**
 * Effect text as display runs; `{ attribute }` marks a check attribute.
 * @typedef {string | Array<string | { attribute: string }>} TraitEffectFixture
 */

/**
 * @typedef {object} TraitActionFixture
 * @property {"reaction" | "specialAttack"} kind
 * @property {string} name
 * @property {string} [conditions]
 * @property {string} description
 */

/**
 * @typedef {object} TraitCardFixture
 * @property {Array<{ label: string, value: string, outsideTraditions?: boolean }>} [meta]
 * @property {Record<string, { effects: TraitEffectFixture[], actions?: TraitActionFixture[] }>} ranks
 */

// Display-only rank captions and cumulative costs, shared by every trait.
const TRAIT_RANKS = {
  novice: { label: "Novice", cost: "10 XP" },
  adept: { label: "Adept", cost: "30 XP" },
  master: { label: "Master", cost: "60 XP" },
};

const QUICK = { attribute: "Quick" };

/**
 * Display text for the trait cards: effects and actions follow the
 * reference entries word for word (the fixture test checks it); meta lines
 * and the outside-traditions mark are fixed for the gallery character, a
 * member of the Order.
 * @type {Record<string, TraitCardFixture>}
 */
const TRAIT_CARDS = {
  acrobatics: {
    meta: [
      { label: "Equipment", value: "Battle Heels" },
      { label: "Attributes", value: "Quick" },
    ],
    ranks: {
      novice: {
        effects: [
          [
            QUICK,
            " check to defend against enemy's free attacks when moving away from, past, or toward them.",
          ],
          "You may cross spaces occupied by an enemy if you can slip through or leap over, but you cannot end your movement there.",
        ],
      },
      adept: {
        effects: [
          "The Adept may use combat heels as if they lacked the unwieldy quality.",
          [
            QUICK,
            " check to instantly spring to your feet as a reaction after falling prone.",
          ],
        ],
        actions: [
          {
            kind: "reaction",
            name: "Bounce Back",
            conditions: "when knocked prone",
            description: "Attempt to get up instantly.",
          },
        ],
      },
      master: {
        effects: [
          "If you end your movement on an enemy, your next attack this turn is made with advantage.",
          [
            QUICK,
            " check to use an enemy as a shield against incoming attacks they can no longer dodge.",
          ],
          "You may end your movement in a space occupied by an enemy if their position allows it.",
        ],
        actions: [
          {
            kind: "reaction",
            name: "Hide Behind Enemy",
            conditions: "when attacked",
            description: "Attempt to hide behind an enemy.",
          },
        ],
      },
    },
  },
  "street-fighting": {
    meta: [
      { label: "Equipment", value: "2 × Short Weapon" },
      { label: "Attributes", value: "Quick" },
    ],
    ranks: {
      novice: {
        effects: [
          "Cheap Shot deals d6 damage and stuns on hit.",
          "The stun allows you to immediately make one more normal attack.",
        ],
        actions: [
          {
            kind: "specialAttack",
            name: "Cheap Shot",
            description:
              "Cheap Shot can stun the target. If successful, you can perform one additional normal attack right after.",
          },
        ],
      },
      adept: {
        effects: [
          [
            QUICK,
            " check to make any successful attack end with a trip or shove that knocks the enemy prone.",
          ],
        ],
        actions: [
          {
            kind: "reaction",
            name: "Knock Over",
            conditions: "after a hit",
            description:
              "After a successful melee atack, can attempt to knock the target prone.",
          },
        ],
      },
      master: {
        effects: [
          "A counterattack as a reaction deals d6 armor-ignoring damage each time the Master is targeted by a melee attack.",
        ],
        actions: [
          {
            kind: "reaction",
            name: "Riposte",
            conditions: "when attacked",
            description:
              "When targeted by a melee attack, the Master can make a counterattack as a reaction.",
          },
        ],
      },
    },
  },
  "mystical-tradition-order": {
    ranks: {
      novice: {
        effects: [
          "Magic knowledge.",
          "The Order Initiate gains no permanent Corruption when learning Novice-tier spells and rituals of the academic tradition.",
        ],
      },
      adept: {
        effects: [
          "Casting academic spells and rituals raises temporary Corruption by no more than one point.",
          "The full Order member gains no permanent Corruption when learning adept-tier spells of their tradition.",
        ],
      },
      master: {
        effects: [
          "The Senior Order Mage gains no permanent Corruption when learning master-tier spells of their tradition.",
          "Failed checks related to the duration or effectiveness of chained and mass spells may be rerolled.",
        ],
      },
    },
  },
  "mystical-tradition-witches-circle": {
    ranks: {
      novice: {
        effects: [
          "Magic knowledge.",
          "The Witch Apprentice gains no permanent Corruption when learning Novice-tier spells and rituals of the wild tradition.",
        ],
      },
      adept: {
        effects: [
          "Casting wild spells and rituals raises temporary Corruption by no more than one point.",
          "The Witch gains no permanent Corruption when learning Adept-tier spells of their tradition.",
        ],
      },
      master: {
        effects: [
          "The Elder Witch of the Mists gains no permanent Corruption when learning master-tier spells of their wild tradition.",
        ],
      },
    },
  },
  anathema: {
    meta: [
      { label: "Attributes", value: "Resolute" },
      {
        label: "Traditions",
        value: "Runes, Theurgy, Circle",
        outsideTraditions: true,
      },
    ],
    ranks: {
      novice: {
        effects: [
          "Resolute lets the mystic remove an ongoing effect of another caster's spell from themselves or from any other target.",
        ],
      },
      adept: {
        effects: [
          "The spell may be used to dispel effects from a whole group of creatures or objects at once.",
        ],
      },
      master: {
        effects: [
          "The Master may remove any magic from an area, including summoned creatures and magically created phenomena.",
        ],
      },
    },
  },
};

/** @type {import("../../public/components/catalog-entry.mjs").TalentLevelView[]} */
const BOON_LEVELS = [
  { level: 1, label: "Level I", cost: "5 XP" },
  { level: 2, label: "Level II", cost: "10 XP" },
  { level: 3, label: "Level III", cost: "15 XP" },
];

/** @type {import("../../public/components/catalog-entry.mjs").TalentLevelView[]} */
const SIN_LEVELS = [
  { level: 1, label: "Level I", cost: "+5 XP" },
];

/**
 * Fixed talent display data: no pricing or check-attribute formatting.
 * @type {Record<string, Pick<import("../../public/components/catalog-entry.mjs").TalentEntryView, "meta" | "cost" | "levels">>}
 */
const TALENT_CARDS = {
  cartographer: {
    cost: "5 / 10 / 15 XP",
    levels: BOON_LEVELS,
    meta: [{ label: "Attributes", value: "Quick" }],
  },
  contacts: {
    cost: "5 XP",
    levels: BOON_LEVELS.slice(0, 1),
    meta: [{ label: "Attributes", value: "Appealing" }],
  },
  damage: {
    cost: "+5 XP",
    levels: SIN_LEVELS,
  },
  deceiver: {
    cost: "5 / 10 / 15 XP",
    levels: BOON_LEVELS,
    meta: [{ label: "Attributes", value: "Appealing, Vigilant" }],
  },
  bloodthirst: {
    cost: "+5 XP",
    levels: SIN_LEVELS,
    meta: [{ label: "Attributes", value: "Vigilant" }],
  },
};

const CATALOG_TITLES = {
  traits: "Traits",
  talents: "Talents",
  rituals: "Rituals",
};

// Fixed display-only snapshots; these are not pricing or eligibility rules.
const PICKER_PRESENTATIONS = {
  traits: {
    kind: "xp",
    balance: "70",
    emptyHint: "Select a rank to learn.",
    blocked: { before: "15", after: "-5", projection: "over" },
    choices: {
      "acrobatics:novice": {
        after: "60",
        summary: "Acrobatics, Novice — 10 XP",
      },
      "acrobatics:adept": {
        after: "40",
        summary: "Acrobatics, Adept — 30 XP",
      },
      "acrobatics:master": {
        after: "10",
        summary: "Acrobatics, Master — 60 XP",
      },
      "street-fighting:novice": {
        after: "60",
        summary: "Street Fighting, Novice — 10 XP",
      },
      "street-fighting:adept": {
        after: "40",
        summary: "Street Fighting, Adept — 30 XP",
      },
      "street-fighting:master": {
        after: "10",
        summary: "Street Fighting, Master — 60 XP",
      },
      "mystical-tradition-order:novice": {
        after: "60",
        summary: "Mystical Tradition: Order, Novice — 10 XP",
      },
      "mystical-tradition-order:adept": {
        after: "40",
        summary: "Mystical Tradition: Order, Adept — 30 XP",
      },
      "mystical-tradition-order:master": {
        after: "10",
        summary: "Mystical Tradition: Order, Master — 60 XP",
      },
      "mystical-tradition-witches-circle:novice": {
        after: "60",
        summary: "Mystical Tradition: Witches' Circle, Novice — 10 XP",
      },
      "mystical-tradition-witches-circle:adept": {
        after: "40",
        summary: "Mystical Tradition: Witches' Circle, Adept — 30 XP",
      },
      "mystical-tradition-witches-circle:master": {
        after: "10",
        summary: "Mystical Tradition: Witches' Circle, Master — 60 XP",
      },
      "anathema:novice": {
        after: "60",
        summary: "Anathema, Novice — 10 XP",
      },
      "anathema:adept": {
        after: "40",
        summary: "Anathema, Adept — 30 XP",
      },
      "anathema:master": {
        after: "10",
        summary: "Anathema, Master — 60 XP",
      },
    },
  },
  talents: {
    kind: "xp",
    balance: "70",
    emptyHint: "Select a level to choose a talent.",
    blocked: { before: "5", after: "-5", projection: "over" },
    choices: {
      "cartographer:1": {
        after: "65",
        summary: "Cartographer, Level I — 5 XP",
      },
      "cartographer:2": {
        after: "60",
        summary: "Cartographer, Level II — 10 XP",
      },
      "cartographer:3": {
        after: "55",
        summary: "Cartographer, Level III — 15 XP",
      },
      "contacts:1": {
        after: "65",
        summary: "Contacts, Level I — 5 XP",
      },
      "damage:1": {
        after: "75",
        kind: "gain",
        summary: "Damage, Level I — +5 XP",
      },
      "deceiver:1": {
        after: "65",
        summary: "Deceiver, Level I — 5 XP",
      },
      "deceiver:2": {
        after: "60",
        summary: "Deceiver, Level II — 10 XP",
      },
      "deceiver:3": {
        after: "55",
        summary: "Deceiver, Level III — 15 XP",
      },
      "bloodthirst:1": {
        after: "75",
        kind: "gain",
        summary: "Bloodthirst, Level I — +5 XP",
      },
    },
  },
  rituals: {
    kind: "count",
    balance: "1",
    limit: "3",
    emptyHint: "Select a ritual to learn.",
    blocked: { before: "3", after: "4", limit: "3", projection: "over" },
    choices: {
      "rite-of-opening-and-sealing:entry": {
        after: "2",
        summary: "Rite of Opening and Rite of Sealing — free",
      },
      "telepathic-interrogation:entry": {
        after: "2",
        summary: "Telepathic Interrogation — free",
      },
    },
  },
};

const VIEWPORTS = {
  desktop: { label: "Desktop", width: 1264, height: 864 },
  slim: { label: "Slim aside", width: 800, height: 864 },
  single: { label: "One column", width: 700, height: 864 },
  phone: { label: "Phone", width: 360, height: 740 },
  "small-phone": { label: "Small phone", width: 320, height: 568 },
  short: { label: "Short window", width: 844, height: 390 },
};

const SCENARIOS = [
  "browse",
  "selected",
  "blocked",
  "unavailable",
  "loading",
  "error",
  "empty",
  "no-matches",
  "ritual-limit",
  "static-header",
];

export {
  CATALOG_FIXTURES,
  CATALOG_TITLES,
  PICKER_PRESENTATIONS,
  SCENARIOS,
  TALENT_CARDS,
  TRAIT_CARDS,
  TRAIT_RANKS,
  VIEWPORTS,
};
