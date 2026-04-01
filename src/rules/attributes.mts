export const SECONDARY_FORMULAS = {
  toughness: {
    default: "strong",
    base: (char, statOverride) => {
      const stat = statOverride || "strong";
      return char.attributes.primary[stat] || 0;
    },
    formula: (base) => Math.max(base, 10),
  },
  painThreshold: {
    default: "strong",
    base: (char, statOverride) => {
      const stat = statOverride || "strong";
      return char.attributes.primary[stat] || 0;
    },
    formula: (base) => Math.ceil(base * 0.5),
  },
  corruptionThreshold: {
    default: "resolute",
    base: (char, statOverride) => {
      const stat = statOverride || "resolute";
      return char.attributes.primary[stat] || 0;
    },
    formula: (base) => Math.ceil(base * 0.5),
  },
  defense: {
    default: "quick",
    base: (char, statOverride) => {
      const stat = statOverride || "quick";
      return char.attributes.primary[stat] || 0;
    },
    formula: (base) => base,
  },
};

export function clampValues(character) {
  const toughness = character.attributes?.secondary?.toughness;

  if (toughness) {
    toughness.current = Math.max(0, Math.min(toughness.current, toughness.max));
  }
}
