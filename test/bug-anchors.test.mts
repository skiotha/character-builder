// Lints that every bug citation in source — written as `NB-<n>` — resolves
// to exactly one entry in the `.github/bugs/` trackers, and that no bug id is
// defined twice across them. Also guards against regressions to the
// pre-migration citation forms (`Bug #N`, the old `engine-weak-points` /
// `api-infra-bugs` filenames). Mirrors `test/adr-anchors.test.mts`.
//
// Mechanism: scan `src/`, `scripts/`, `test/` for `NB-<n>` tokens; collect the
// defined ids from the `### NB-<n>.` headings in every tracker file under
// `.github/bugs/`; assert every cite resolves and every id is unique.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts", "test"];
const BUGS_DIR = join(ROOT, ".github", "bugs");
const SELF = "bug-anchors.test.mts";

// `NB-<n>` citation in source. The global flag is for `matchAll`.
const CITE_RE = /\bNB-(\d+)\b/g;
// `### NB-<n>.` entry heading in a tracker file.
const HEADING_RE = /^### NB-(\d+)\./gm;
// Pre-migration forms that must not reappear in code (non-global: `.test`).
const LEGACY_BUG_RE = /\bBug #\d+\b/;
const LEGACY_FILE_RE = /engine-weak-points|api-infra-bugs/;

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

/** Every tracker file under `.github/bugs/` — any `*.md` except this README. */
function trackerFiles(): string[] {
  return readdirSync(BUGS_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
}

/** Bug ids declared by `### NB-<n>.` headings, mapped to the tracker file(s) they appear in. */
function definedIds(): Map<string, string[]> {
  const byId = new Map<string, string[]>();
  for (const name of trackerFiles()) {
    const text = readFileSync(join(BUGS_DIR, name), "utf8");
    for (const m of text.matchAll(HEADING_RE)) {
      const id = m[1]!;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id)!.push(name);
    }
  }
  return byId;
}

describe("NB bug-id citations resolve", () => {
  const defined = definedIds();

  // Distinct cited ids across the scanned tree, with a sample citing file,
  // plus any surviving pre-migration citation forms.
  const seen = new Map<string, string>();
  const legacyHits: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkMts(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      const rel = file.slice(ROOT.length + 1).replaceAll("\\", "/");
      for (const m of text.matchAll(CITE_RE)) {
        if (!seen.has(m[1]!)) seen.set(m[1]!, rel);
      }
      if (LEGACY_BUG_RE.test(text)) legacyHits.push(`${rel} — bare \`Bug #N\``);
      if (LEGACY_FILE_RE.test(text))
        legacyHits.push(`${rel} — old tracker filename`);
    }
  }
  const cites = [...seen.entries()];

  it("finds NB citations to lint", () => {
    assert.ok(cites.length > 0, "no `NB-<n>` citations found to lint");
  });

  it("every bug id is defined exactly once across the trackers", () => {
    const dups = [...defined.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([id, files]) => `NB-${id} in ${files.join(", ")}`);
    assert.deepEqual(dups, [], `duplicate NB ids: ${dups.join("; ")}`);
  });

  it("no pre-migration `Bug #N` or old tracker filenames remain in code", () => {
    assert.deepEqual(
      legacyHits,
      [],
      `legacy bug-citation forms found:\n  ${legacyHits.join("\n  ")}`,
    );
  });

  for (const [id, rel] of cites) {
    it(`NB-${id} (e.g. ${rel}) resolves to a tracker entry`, () => {
      assert.ok(
        defined.has(id),
        `NB-${id} is cited but not defined in any .github/bugs/ tracker`,
      );
    });
  }
});
