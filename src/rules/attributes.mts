interface SecondaryFormulaRule {
  default: string;
  base: (char: Record<string, unknown>, statOverride?: string) => number;
  formula: (base: number) => number;
}

export const SECONDARY_FORMULAS: Record<string, SecondaryFormulaRule> = {
  toughness: {
    default: "strong",
    base: (char, statOverride) => {
      const stat = statOverride || "strong";
      const primary = (char.attributes as Record<string, unknown> | undefined)
        ?.primary as Record<string, number> | undefined;
      return primary?.[stat] ?? 0;
    },
    formula: (base) => Math.max(base, 10),
  },
  painThreshold: {
    default: "strong",
    base: (char, statOverride) => {
      const stat = statOverride || "strong";
      const primary = (char.attributes as Record<string, unknown> | undefined)
        ?.primary as Record<string, number> | undefined;
      return primary?.[stat] ?? 0;
    },
    formula: (base) => Math.ceil(base * 0.5),
  },
  corruptionThreshold: {
    default: "resolute",
    base: (char, statOverride) => {
      const stat = statOverride || "resolute";
      const primary = (char.attributes as Record<string, unknown> | undefined)
        ?.primary as Record<string, number> | undefined;
      return primary?.[stat] ?? 0;
    },
    formula: (base) => Math.ceil(base * 0.5),
  },
  defense: {
    default: "quick",
    base: (char, statOverride) => {
      const stat = statOverride || "quick";
      const primary = (char.attributes as Record<string, unknown> | undefined)
        ?.primary as Record<string, number> | undefined;
      return primary?.[stat] ?? 0;
    },
    formula: (base) => base,
  },
  armor: {
    default: "equipment",
    base: (char) => {
      const equipment = char.equipment as Record<string, unknown> | undefined;
      const armorObj = equipment?.armor as Record<string, unknown> | undefined;
      const body = armorObj?.body as { defense?: number } | null | undefined;
      return body?.defense ?? 0;
    },
    formula: (base) => base,
  },
  corruptionMax: {
    default: "resolute",
    base: (char, statOverride) => {
      const stat = statOverride || "resolute";
      const primary = (char.attributes as Record<string, unknown> | undefined)
        ?.primary as Record<string, number> | undefined;
      return primary?.[stat] ?? 0;
    },
    formula: (base) => base,
  },
};

export function clampValues(character: Record<string, unknown>): void {
  const attrs = character.attributes as
    | Record<string, Record<string, unknown>>
    | undefined;
  const toughness = attrs?.secondary?.toughness as
    | { current: number; max: number }
    | undefined;

  if (toughness) {
    toughness.current = Math.max(0, Math.min(toughness.current, toughness.max));
  }
}
