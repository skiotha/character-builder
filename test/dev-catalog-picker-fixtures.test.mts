import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CATALOG_FIXTURES,
  PICKER_PRESENTATIONS,
} from "../dev/catalog-picker/fixtures.mjs";

const REFERENCE_FILES = {
  ability: "abilities.en.json",
  spell: "spells.en.json",
  boon: "boons.en.json",
  sin: "sins.en.json",
  ritual: "rituals.en.json",
};

interface ReferenceEntry {
  id: string;
  name: string;
  description: string;
  tiers?: Record<string, unknown>;
  levels?: number;
  tradition?: string;
  traditions?: string[];
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
});
