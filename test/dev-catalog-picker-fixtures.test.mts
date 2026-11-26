import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CATALOG_FIXTURES,
  PICKER_PRESENTATIONS,
  TALENT_CARDS,
  TRAIT_CARDS,
  TRAIT_RANKS,
} from "../dev/catalog-picker/fixtures.mjs";

const REFERENCE_FILES = {
  ability: "abilities.en.json",
  spell: "spells.en.json",
  boon: "boons.en.json",
  sin: "sins.en.json",
  ritual: "rituals.en.json",
};

interface ReferenceAction {
  name: string;
  description: string;
}

interface ReferenceTier {
  effects?: Array<{ description: string }>;
  reactions?: ReferenceAction[];
  specialAttacks?: ReferenceAction[];
}

interface ReferenceEntry {
  id: string;
  name: string;
  description: string;
  tiers?: Record<string, ReferenceTier>;
  levels?: number;
  tradition?: string;
  traditions?: string[];
  check?: string[];
}

const referenceEntries: Array<
  readonly [string, Map<string, ReferenceEntry>]
> = await Promise.all(
  Object.entries(REFERENCE_FILES).map(async ([kind, filename]) => {
    const entries = JSON.parse(
      await readFile(join(process.cwd(), "reference", filename), "utf8"),
    ) as ReferenceEntry[];
    return [kind, new Map(entries.map((entry) => [entry.id, entry]))] as const;
  }),
);
const references = new Map(referenceEntries);

describe("catalog picker gallery fixtures", () => {
  for (const [catalog, fixtures] of Object.entries(CATALOG_FIXTURES)) {
    for (const fixture of fixtures) {
      const kind =
        catalog === "traits"
          ? fixture.source
          : catalog === "talents"
            ? fixture.source
            : "ritual";

      it(`${fixture.id} stays aligned with its reference entry`, () => {
        assert.ok(kind, `fixture ${fixture.id} is missing its source kind`);
        const source = references.get(kind)?.get(fixture.id);
        assert.ok(source, `missing ${kind} reference entry ${fixture.id}`);
        assert.equal(fixture.name, source.name);
        assert.equal(fixture.description, source.description);

        if (fixture.tiers) {
          assert.ok(source.tiers);
          assert.deepEqual(fixture.tiers, Object.keys(source.tiers));
        }
        if (fixture.levels !== undefined) {
          assert.equal(fixture.levels, source.levels);
        }
        if (fixture.tradition) {
          assert.equal(fixture.tradition, source.tradition);
        }
        if (fixture.traditions) {
          assert.deepEqual(fixture.traditions, source.traditions);
        }
      });
    }
  }

  for (const catalog of ["traits", "talents", "rituals"] as const) {
    for (const fixture of CATALOG_FIXTURES[catalog]) {
      const choices = fixture.tiers
        ? fixture.tiers.map((tier) => `${fixture.id}:${tier}`)
        : fixture.levels !== undefined
          ? Array.from(
              { length: fixture.levels },
              (_, index) => `${fixture.id}:${index + 1}`,
            )
          : [`${fixture.id}:entry`];

      for (const choice of choices) {
        it(`${catalog} picker has display data for ${choice}`, () => {
          assert.ok(
            Object.hasOwn(PICKER_PRESENTATIONS[catalog].choices, choice),
            `missing picker presentation for ${choice}`,
          );
        });
      }
    }
  }

  it("trait cards cover exactly the trait fixtures", () => {
    assert.deepEqual(
      Object.keys(TRAIT_CARDS).sort(),
      CATALOG_FIXTURES.traits.map((fixture) => fixture.id).sort(),
    );
  });

  for (const fixture of CATALOG_FIXTURES.traits) {
    it(`${fixture.id} card text follows its reference tiers`, () => {
      const card = TRAIT_CARDS[fixture.id];
      const source = references.get(fixture.source!)?.get(fixture.id);
      assert.ok(card && source?.tiers);
      assert.deepEqual(Object.keys(card.ranks), Object.keys(source.tiers));

      for (const [tier, rank] of Object.entries(card.ranks)) {
        assert.ok(Object.hasOwn(TRAIT_RANKS, tier), `no rank caption for ${tier}`);
        const reference: ReferenceTier = source.tiers[tier]!;
        assert.deepEqual(
          rank.effects.map((effect) =>
            typeof effect === "string"
              ? effect
              : effect
                  .map((run) => (typeof run === "string" ? run : run.attribute))
                  .join(""),
          ),
          (reference.effects ?? []).map((effect) => effect.description),
          `${fixture.id} ${tier} effects`,
        );
        assert.deepEqual(
          (rank.actions ?? []).map(({ kind, name, description }) => ({
            kind,
            name,
            description,
          })),
          [
            ...(reference.specialAttacks ?? []).map((action) => ({
              kind: "specialAttack",
              name: action.name,
              description: action.description,
            })),
            ...(reference.reactions ?? []).map((action) => ({
              kind: "reaction",
              name: action.name,
              description: action.description,
            })),
          ],
          `${fixture.id} ${tier} actions`,
        );
      }
    });
  }

  it("talent cards cover the fixture levels and reference check metadata", () => {
    const presentations = new Map(
      Object.entries(PICKER_PRESENTATIONS.talents.choices),
    );
    assert.deepEqual(
      Object.keys(TALENT_CARDS).sort(),
      CATALOG_FIXTURES.talents.map((fixture) => fixture.id).sort(),
    );
    for (const fixture of CATALOG_FIXTURES.talents) {
      const card = TALENT_CARDS[fixture.id]!;
      const source = references.get(fixture.source!)!.get(fixture.id)!;
      assert.deepEqual(
        card.levels.map(({ level }) => level),
        Array.from({ length: source.levels! }, (_, index) => index + 1),
        `${fixture.id} level choices`,
      );
      const attributes = source.check?.map(
        (attribute) => attribute[0]!.toUpperCase() + attribute.slice(1),
      );
      assert.deepEqual(
        card.meta ?? [],
        attributes ? [{ label: "Attributes", value: attributes.join(", ") }] : [],
        `${fixture.id} check metadata`,
      );
      for (const level of card.levels) {
        const key = `${fixture.id}:${level.level}`;
        const presentation = presentations.get(key);
        assert.ok(presentation, `missing picker presentation for ${key}`);
        assert.equal(
          presentation.summary,
          `${fixture.name}, ${level.label} — ${level.cost}`,
          `${key} card and footer agree`,
        );
      }
    }
  });
});
