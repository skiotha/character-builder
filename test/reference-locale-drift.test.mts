import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { REFERENCE_DIR } from "#config";

/**
 * Locale-drift lint.
 *
 * For each topic that ships in both en and ru: assert the two files have
 * the same set of entry ids (in the same order) and that every leaf
 * deep-equals between the two files **except** for fields in the
 * localized-fields allowlist below.
 *
 * The allowlist is uniform across topics: `name`, `description`, `tags`.
 * Whenever a key in the allowlist is encountered during traversal, its
 * value is skipped — comparison neither requires presence on either side
 * nor any structural similarity. This is intentional: those fields are
 * display-only, the engine never reads them, and translators need
 * freedom on length / wording / optional presence.
 *
 * Failure mode: throws with the JSON path of the first mismatch and
 * both values.
 *
 * See ADR-016 and `.github/plans/phase6-chunkF-prereqs-plan.md` Task 1.
 */

const TOPICS = [
  "abilities",
  "spells",
  "boons",
  "sins",
  "rituals",
  "weapons",
  "armor",
  "qualities",
  "statuses",
] as const;

const LOCALIZED_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "description",
  "tags",
]);

interface Entry {
  id: string;
  [key: string]: unknown;
}

async function loadTopic(topic: string, locale: string): Promise<Entry[]> {
  const filePath = path.join(REFERENCE_DIR, `${topic}.${locale}.json`);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as Entry[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compare two arbitrary JSON values, skipping any object key in
 * `LOCALIZED_FIELDS`. Throws on the first mismatch with a JSON path
 * pointer (e.g. `weapons[12].damage`).
 *
 * Exported only for unit-testing the corner cases at the bottom of
 * this file. Production callers should use the `describe`-blocks above.
 */
export function assertEqualNonLocalized(
  en: unknown,
  ru: unknown,
  jsonPath: string,
): void {
  // Arrays must match in length and element-wise.
  if (Array.isArray(en) || Array.isArray(ru)) {
    if (!Array.isArray(en) || !Array.isArray(ru)) {
      throw new Error(
        `Drift at ${jsonPath}: en and ru disagree on array vs non-array (en=${typeof en}, ru=${typeof ru})`,
      );
    }
    if (en.length !== ru.length) {
      throw new Error(
        `Drift at ${jsonPath}: array length differs (en=${en.length}, ru=${ru.length})`,
      );
    }
    for (let i = 0; i < en.length; i += 1) {
      assertEqualNonLocalized(en[i], ru[i], `${jsonPath}[${i}]`);
    }
    return;
  }

  // Plain objects: compare key sets (excluding localized fields), then
  // recurse into each non-localized key.
  if (isPlainObject(en) || isPlainObject(ru)) {
    if (!isPlainObject(en) || !isPlainObject(ru)) {
      throw new Error(
        `Drift at ${jsonPath}: en and ru disagree on object vs non-object (en=${typeof en}, ru=${typeof ru})`,
      );
    }
    const enKeys = Object.keys(en).filter((k) => !LOCALIZED_FIELDS.has(k));
    const ruKeys = Object.keys(ru).filter((k) => !LOCALIZED_FIELDS.has(k));
    const enSet = new Set(enKeys);
    const ruSet = new Set(ruKeys);
    for (const k of enKeys) {
      if (!ruSet.has(k)) {
        throw new Error(
          `Drift at ${jsonPath}: key '${k}' present in en but not ru`,
        );
      }
    }
    for (const k of ruKeys) {
      if (!enSet.has(k)) {
        throw new Error(
          `Drift at ${jsonPath}: key '${k}' present in ru but not en`,
        );
      }
    }
    for (const k of enKeys) {
      assertEqualNonLocalized(en[k], ru[k], `${jsonPath}.${k}`);
    }
    return;
  }

  // Primitives — strict equality.
  if (en !== ru) {
    throw new Error(
      `Drift at ${jsonPath}: en=${JSON.stringify(en)}, ru=${JSON.stringify(ru)}`,
    );
  }
}

describe("reference locale drift", () => {
  for (const topic of TOPICS) {
    describe(topic, () => {
      it("en and ru agree on id set and order, and on all non-localized fields", async () => {
        const [en, ru] = await Promise.all([
          loadTopic(topic, "en"),
          loadTopic(topic, "ru"),
        ]);

        assert.equal(
          en.length,
          ru.length,
          `${topic}: entry count differs (en=${en.length}, ru=${ru.length})`,
        );

        for (let i = 0; i < en.length; i += 1) {
          const enId = en[i]?.id;
          const ruId = ru[i]?.id;
          assert.equal(
            enId,
            ruId,
            `${topic}: entry order differs at index ${i} (en='${enId}', ru='${ruId}')`,
          );
        }

        for (let i = 0; i < en.length; i += 1) {
          assertEqualNonLocalized(en[i], ru[i], `${topic}[${i}]`);
        }
      });
    });
  }

  // Explicit pin: nested `id` strings on specialAttacks / reactions
  // must agree across en and ru. The deep-equals pass above already
  // enforces this transitively, but this sub-test makes the contract
  // unmistakeable so a future addition of nested locale-allowlist
  // fields cannot silently relax it (ADR-014, Item 9).
  describe("nested action id parity (abilities + spells)", () => {
    for (const topic of ["abilities", "spells"] as const) {
      it(`${topic}: nested specialAttack/reaction ids agree between en and ru`, async () => {
        const [en, ru] = await Promise.all([
          loadTopic(topic, "en"),
          loadTopic(topic, "ru"),
        ]);
        for (let i = 0; i < en.length; i += 1) {
          const enEntry = en[i] as Record<string, unknown>;
          const ruEntry = ru[i] as Record<string, unknown>;
          const enTiers = (enEntry.tiers ?? {}) as Record<string, unknown>;
          const ruTiers = (ruEntry.tiers ?? {}) as Record<string, unknown>;
          for (const tierKey of Object.keys(enTiers)) {
            const enTier = (enTiers[tierKey] ?? {}) as Record<string, unknown>;
            const ruTier = (ruTiers[tierKey] ?? {}) as Record<string, unknown>;
            for (const field of ["specialAttacks", "reactions"] as const) {
              const enList = (enTier[field] ?? []) as Array<{ id?: unknown }>;
              const ruList = (ruTier[field] ?? []) as Array<{ id?: unknown }>;
              assert.equal(
                enList.length,
                ruList.length,
                `${topic}[${i}].tiers.${tierKey}.${field}: length differs`,
              );
              for (let j = 0; j < enList.length; j += 1) {
                assert.equal(
                  enList[j]?.id,
                  ruList[j]?.id,
                  `${topic}[${i}].tiers.${tierKey}.${field}[${j}].id: en='${String(enList[j]?.id)}', ru='${String(ruList[j]?.id)}'`,
                );
              }
            }
          }
        }
      });
    }
  });
});
