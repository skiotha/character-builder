/**
 * @typedef {object} CatalogFixture
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {string[]} [tiers]
 * @property {number} [levels]
 * @property {string} [levelNote]
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
    levelNote: "Boon · 5 XP per level",
  },
  {
    id: "bloodthirst",
    name: "Bloodthirst",
    description:
      "If the character, their enemy, or someone nearby has taken damage, the character cannot spare an enemy even if that enemy surrenders. Resisting the effect requires 1 experience and an Vigilant check.",
    source: "sin",
    tags: ["sin", "status", "corruption"],
    levels: 1,
    levelNote: "Sin · grants 5 XP per level",
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

const CATALOG_TITLES = {
  traits: "Traits",
  talents: "Talents",
  rituals: "Rituals",
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
];

export {
  CATALOG_FIXTURES,
  CATALOG_TITLES,
  SCENARIOS,
  VIEWPORTS,
};
