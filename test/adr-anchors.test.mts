// Lints that every stable-anchor citation in source — written as
// `ADR-NNN §anchor` — resolves to an anchor declared in that ADR's
// "Stable anchors" registry table. Catches dangling cites left behind
// when an anchor is renamed or removed without updating citing code.
//
// Mechanism: scan `src/`, `scripts/`, `test/` for `ADR-NNN §anchor`
// tokens; for each, read `docs/decisions/NNN-*.md`, extract the anchor
// set declared in its "## Stable anchors" table, and assert membership.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts", "test"];
const DECISIONS_DIR = join(ROOT, "docs", "decisions");
const SELF = "adr-anchors.test.mts";

// `ADR-NNN §anchor` — anchor is a lowercase/digit/hyphen token, covering
// named anchors (`action-rewrite`) and frozen section numbers (`3a`).
const CITE_RE = /ADR-(\d{3})\s+§([a-z0-9][a-z0-9-]*)/g;
// A row of a "## Stable anchors" table: `| `§anchor` | … |`.
const ROW_RE = /^\|\s*`§([a-z0-9][a-z0-9-]*)`/gm;

function walkMts(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMts(full));
    else if (entry.name.endsWith(".mts") && entry.name !== SELF) out.push(full);
  }
  return out;
}

/** Anchors declared in an ADR file's "## Stable anchors" table, or null if no such ADR file. */
function declaredAnchors(adrNum: string): Set<string> | null {
  const file = readdirSync(DECISIONS_DIR).find(
    (f) => f.startsWith(`${adrNum}-`) && f.endsWith(".md"),
  );
  if (!file) return null;
  const text = readFileSync(join(DECISIONS_DIR, file), "utf8");
  const heading = "## Stable anchors";
  const start = text.indexOf(heading);
  if (start === -1) return new Set();
  const rest = text.slice(start + heading.length);
  const nextHeading = rest.search(/\n## /);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const anchors = new Set<string>();
  for (const m of section.matchAll(ROW_RE)) anchors.add(m[1]!);
  return anchors;
}

describe("ADR stable-anchor citations resolve", () => {
  // Distinct (adr, anchor) citations across the scanned tree, with a
  // sample citing file for the failure message.
  const seen = new Map<string, { adr: string; anchor: string; file: string }>();
  for (const dir of SCAN_DIRS) {
    for (const file of walkMts(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(CITE_RE)) {
        const key = `${m[1]} ${m[2]}`;
        if (!seen.has(key)) {
          seen.set(key, { adr: m[1]!, anchor: m[2]!, file });
        }
      }
    }
  }
  const cites = [...seen.values()];

  const declaredCache = new Map<string, Set<string> | null>();
  const declaredFor = (adr: string): Set<string> | null => {
    if (!declaredCache.has(adr)) declaredCache.set(adr, declaredAnchors(adr));
    return declaredCache.get(adr)!;
  };

  it("finds stable-anchor citations to lint", () => {
    assert.ok(cites.length > 0, "no `ADR-NNN §anchor` citations found to lint");
  });

  for (const { adr, anchor, file } of cites) {
    const rel = file.slice(ROOT.length + 1).replaceAll("\\", "/");
    it(`ADR-${adr} \u00a7${anchor} (e.g. ${rel}) is registered`, () => {
      const set = declaredFor(adr);
      assert.ok(set !== null, `docs/decisions/${adr}-*.md not found`);
      assert.ok(
        set.has(anchor),
        `ADR-${adr} \u00a7${anchor} is not listed in that ADR's "## Stable anchors" table`,
      );
    });
  }
});
