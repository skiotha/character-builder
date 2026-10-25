import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  excludeEntries,
  matchesFilters,
  matchesQuery,
  normalizeText,
  parseQuery,
  searchHaystack,
} from "../public/utils/catalog-filter.mjs";

const polearm = {
  id: "polearm",
  name: "Polearm Mastery",
  source: "ability",
  tags: ["combat", "Reach"],
  tiers: { novice: { summary: "Long weapons strike first" } },
};
const breakWill = {
  id: "break-will",
  name: "Break Will",
  source: "spell",
  tags: ["magic", "order"],
  traditions: ["order", "circle"],
};
const ecole = {
  id: "ecole",
  name: "École Ёжик",
  source: "ability",
  tags: [],
};

describe("normalizeText", () => {
  it("lower-cases and strips diacritics", () => {
    assert.equal(normalizeText("École"), "ecole");
    assert.equal(normalizeText("Ёжик"), "ежик");
    assert.equal(normalizeText("ÄÖÜ ñ"), "aou n");
  });
});

describe("parseQuery", () => {
  it("splits on any whitespace and folds each token", () => {
    assert.deepEqual(parseQuery("  Break\tWÍLL \n"), ["break", "will"]);
  });

  it("returns no tokens for a blank query", () => {
    assert.deepEqual(parseQuery(""), []);
    assert.deepEqual(parseQuery("   "), []);
  });
});

describe("searchHaystack", () => {
  it("reads string keys and array keys element-wise", () => {
    assert.deepEqual(searchHaystack(polearm, ["name", "tags"]), [
      "polearm mastery",
      "combat",
      "reach",
    ]);
  });

  it("calls accessor fields and accepts string or array results", () => {
    const haystack = searchHaystack(polearm, [
      (entry) => (entry as typeof polearm).tiers.novice.summary,
      () => ["Extra", "Words"],
    ]);
    assert.deepEqual(haystack, ["long weapons strike first", "extra", "words"]);
  });

  it("ignores missing, empty and non-string values", () => {
    const entry = { id: "x", name: "", tags: ["ok", 3, null], level: 2 };
    assert.deepEqual(
      searchHaystack(entry, ["name", "tags", "level", "missing", () => null]),
      ["ok"],
    );
  });
});

describe("matchesQuery", () => {
  const haystack = searchHaystack(breakWill, ["name", "tags"]);

  it("matches everything with no tokens", () => {
    assert.equal(matchesQuery(haystack, []), true);
    assert.equal(matchesQuery([], []), true);
  });

  it("matches substrings", () => {
    assert.equal(matchesQuery(haystack, parseQuery("wil")), true);
    assert.equal(matchesQuery(haystack, parseQuery("xyz")), false);
  });

  it("requires every token, each in any field", () => {
    assert.equal(matchesQuery(haystack, parseQuery("will order")), true);
    assert.equal(matchesQuery(haystack, parseQuery("will sorcery")), false);
  });

  it("is case- and diacritic-insensitive on both sides", () => {
    const folded = searchHaystack(ecole, ["name"]);
    assert.equal(matchesQuery(folded, parseQuery("ECOLE")), true);
    assert.equal(matchesQuery(folded, parseQuery("ежик")), true);
    assert.equal(matchesQuery(haystack, parseQuery("BRÉAK")), true);
  });
});

describe("matchesFilters", () => {
  const isAbility = (entry: object) =>
    (entry as { source: string }).source === "ability";
  const isSpell = (entry: object) =>
    (entry as { source: string }).source === "spell";
  const inOrder = (entry: object) =>
    ((entry as { traditions?: string[] }).traditions ?? []).includes("order");

  it("passes everything with no groups or only empty groups", () => {
    assert.equal(matchesFilters(polearm, []), true);
    assert.equal(matchesFilters(polearm, [[], []]), true);
  });

  it("ORs options within a group", () => {
    assert.equal(matchesFilters(polearm, [[isAbility, isSpell]]), true);
    assert.equal(matchesFilters(breakWill, [[isAbility, isSpell]]), true);
    assert.equal(matchesFilters(breakWill, [[isAbility]]), false);
  });

  it("ANDs groups, an empty group not restricting", () => {
    assert.equal(matchesFilters(breakWill, [[isSpell], [inOrder]]), true);
    assert.equal(matchesFilters(polearm, [[isAbility], [inOrder]]), false);
    assert.equal(matchesFilters(polearm, [[isAbility], []]), true);
  });
});

describe("excludeEntries", () => {
  const entries = [polearm, breakWill, ecole];

  it("drops excluded ids and keeps order", () => {
    assert.deepEqual(excludeEntries(entries, new Set(["break-will"])), [
      polearm,
      ecole,
    ]);
    assert.deepEqual(excludeEntries(entries, ["ecole", "polearm"]), [
      breakWill,
    ]);
  });

  it("returns a copy when nothing is excluded", () => {
    for (const exclude of [undefined, [], new Set<string>()]) {
      const result = excludeEntries(entries, exclude);
      assert.deepEqual(result, entries);
      assert.notEqual(result, entries);
    }
  });

  it("ignores unknown ids and does not mutate the input", () => {
    const before = [...entries];
    excludeEntries(entries, ["nope"]);
    assert.deepEqual(entries, before);
  });
});
