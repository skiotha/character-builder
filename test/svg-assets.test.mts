import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cleanSvg, modeFor } from "../scripts/clean-svg.mts";

const ASSETS = join(import.meta.dirname, "..", "public", "assets");
const CLEANED_DIRS = ["icons", "decor", "strokes"];

async function svgFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".svg"))
    .map((e) => join(e.parentPath, e.name));
}

const files = (
  await Promise.all(CLEANED_DIRS.map((d) => svgFiles(join(ASSETS, d))))
).flat();

describe("committed SVG assets", () => {
  it("finds assets to check", () => {
    assert.ok(files.length > 0);
  });

  for (const file of files) {
    const name = relative(ASSETS, file).replaceAll("\\", "/");
    it(`${name} is clean (run scripts/clean-svg.mts)`, async () => {
      const source = await readFile(file, "utf8");
      assert.equal(cleanSvg(source, modeFor(file)), source);
    });
  }
});

describe("cleanSvg", () => {
  it("strips export noise and keeps only referenced ids", () => {
    const out = cleanSvg(
      `<?xml version="1.0"?>
<svg id="Layer_2" data-name="Layer 2" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
  <title>x</title>
  <defs><clipPath id="c"><rect width="4" height="4" fill="white"/></clipPath></defs>
  <g id="Icon"><g clip-path="url(#c)"><path d="M0 0" style="fill: #efbf04;"/></g></g>
</svg>`,
      "swap",
    );
    assert.equal(
      out,
      `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="c">
      <rect width="4" height="4" fill="white"/>
    </clipPath>
  </defs>
  <g clip-path="url(#c)">
    <path d="M0 0" fill="currentColor"/>
  </g>
</svg>
`,
    );
  });

  it("maps multi-tone palette roles to custom properties", () => {
    const out = cleanSvg(
      `<svg viewBox="0 0 1 1"><path fill="#EFBF04"/><path fill="#ef1a04"/><path fill="#fff"/></svg>`,
      "swap",
    );
    assert.match(out, /<path fill="currentColor"\/>/);
    assert.match(out, /<path style="fill: var\(--icon-secondary\)"\/>/);
    assert.match(out, /<path style="fill: var\(--icon-light\)"\/>/);
  });

  it("rejects an unknown colour in a multi-tone icon", () => {
    assert.throws(
      () =>
        cleanSvg(
          `<svg viewBox="0 0 1 1"><path fill="#efbf04"/><path fill="#123456"/></svg>`,
          "swap",
        ),
      /unknown colour #123456/,
    );
  });

  it("splits grade discs into disc and letter", () => {
    const out = cleanSvg(
      `<svg viewBox="0 0 1 1"><path fill="#45C1B4"/><path fill="#1B1614"/></svg>`,
      "disc",
    );
    assert.match(out, /fill: var\(--grade-disc\)/);
    assert.match(out, /fill: var\(--grade-letter\)/);
  });

  it("leaves decor colours baked", () => {
    const out = cleanSvg(
      `<svg viewBox="0 0 1 1"><path style="fill: #efbf04;"/><path fill="#ef1a04"/></svg>`,
      "keep",
    );
    assert.match(out, /<path fill="#efbf04"\/>/);
    assert.match(out, /<path fill="#ef1a04"\/>/);
  });
});
