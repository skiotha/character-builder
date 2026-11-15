/**
 * SVG asset cleaner.
 *
 * Normalises hand-exported SVGs (Illustrator, Figma) under
 * `public/assets/` so the client can recolour them from CSS (DS §assets).
 * Rewrites files in place; a clean file is a fixed point, so running the
 * cleaner twice changes nothing. `test/svg-assets.test.mts` relies on that
 * and fails on any committed asset the cleaner would still change.
 *
 * Structural pass (every mode):
 *   - drops the XML prolog, comments, DOCTYPE, `<metadata>`, `<title>`,
 *     `<desc>`, and `data-name` attributes;
 *   - keeps an `id` only when something in the file references it
 *     (`url(#id)` / `href="#id"`);
 *   - drops the root `width` / `height` (synthesising `viewBox` from them
 *     if it is missing), so CSS alone sizes the graphic;
 *   - unwraps `<g>` elements left with no attributes;
 *   - prints one tag per line, indented by depth.
 *
 * Colour pass — the mode comes from the file's location (`modeFor`):
 *   - `keep`  — `decor/**`: multi-tone illustrations keep baked colours.
 *   - `disc`  — `grade-*` / `level-*`: the dark letter becomes
 *     `var(--grade-letter)`, every other colour `var(--grade-disc)`.
 *   - `swap`  — everything else: a single-colour file becomes
 *     `currentColor`; multi-tone files map palette roles (yellows →
 *     `currentColor`, reds → `--icon-secondary`, ink → `--icon-ink`,
 *     white → `--icon-light`). An unknown colour is an error, so a stray
 *     export can't sneak a baked colour past the lint.
 * Colours inside `<clipPath>` / `<mask>` are geometry and never touched.
 * `var()` goes into a `style` declaration (presentation attributes don't
 * reliably resolve custom properties); plain keywords stay attributes.
 *
 * Usage:
 *   node scripts/clean-svg.mts <file-or-dir> [...]
 *   node scripts/clean-svg.mts --check <file-or-dir> [...]   # report, don't write
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export type CleanMode = "keep" | "disc" | "swap";

const DROPPED_ELEMENTS = new Set(["metadata", "title", "desc"]);
const GEOMETRY_ELEMENTS = new Set(["clipPath", "mask"]);
const ROOT_DROPPED_ATTRS = new Set([
  "width",
  "height",
  "x",
  "y",
  "version",
  "xml:space",
  "enable-background",
]);
const PAINT_PROPS = ["fill", "stroke"] as const;

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
};

const SWAP_ROLES: Record<string, string> = {
  "#efbf04": "currentColor",
  "#f1c724": "currentColor",
  "#ef1a04": "var(--icon-secondary)",
  "#f13724": "var(--icon-secondary)",
  "#f14634": "var(--icon-secondary)",
  "#1b1614": "var(--icon-ink)",
  "#ffffff": "var(--icon-light)",
  "#fdfdff": "var(--icon-light)",
};

const DISC_LETTER = "#1b1614";

interface Attr {
  name: string;
  value: string;
}

interface Tag {
  kind: "open" | "close" | "self";
  name: string;
  attrs: Attr[];
}

type Token = Tag | { kind: "text"; text: string };

/** Picks the colour mode from an asset path (see the module header). */
export function modeFor(path: string): CleanMode {
  const parts = path.split(/[\\/]/);
  if (parts.includes("decor")) return "keep";
  const file = parts.at(-1) ?? "";
  if (/^(grade|level)-/.test(file)) return "disc";
  return "swap";
}

function parseAttrs(source: string): Attr[] {
  const attrs: Attr[] = [];
  for (const m of source.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs.push({ name: m[1]!, value: m[2] ?? m[3] ?? "" });
  }
  return attrs;
}

function tokenize(source: string): Token[] {
  if (source.includes("<![CDATA[")) {
    throw new Error("CDATA sections are not supported");
  }
  const stripped = source
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  const tokens: Token[] = [];
  for (const m of stripped.matchAll(/<[^>]+>|[^<]+/g)) {
    const raw = m[0];
    if (!raw.startsWith("<")) {
      const text = raw.trim();
      if (text) tokens.push({ kind: "text", text });
      continue;
    }
    if (raw.startsWith("</")) {
      tokens.push({ kind: "close", name: raw.slice(2, -1).trim(), attrs: [] });
      continue;
    }
    const self = raw.endsWith("/>");
    const body = raw.slice(1, self ? -2 : -1);
    const name = body.match(/^[\w:.-]+/)?.[0] ?? "";
    tokens.push({
      kind: self ? "self" : "open",
      name,
      attrs: parseAttrs(body.slice(name.length)),
    });
  }
  return tokens;
}

function referencedIds(source: string): Set<string> {
  const ids = new Set<string>();
  for (const m of source.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g)) ids.add(m[1]!);
  for (const m of source.matchAll(/href\s*=\s*["']#([^"']+)/g)) ids.add(m[1]!);
  return ids;
}

function parseStyle(style: string): Attr[] {
  return style
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(":");
      return {
        name: decl.slice(0, colon).trim(),
        value: decl.slice(colon + 1).trim(),
      };
    });
}

function normaliseHex(value: string): string | undefined {
  const lower = value.trim().toLowerCase();
  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  const m = lower.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return undefined;
  const hex = m[1]!;
  return hex.length === 3
    ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : `#${hex}`;
}

/**
 * Moves every `fill` / `stroke` (attribute or style declaration) onto one
 * canonical spot: `var()` values into `style`, anything else into the
 * attribute. Returns the paint values found, in order, so the caller can
 * remap them.
 */
function collectPaint(tag: Tag): { prop: string; value: string }[] {
  const paint: { prop: string; value: string }[] = [];
  const styleAttr = tag.attrs.find((a) => a.name === "style");
  const decls = styleAttr ? parseStyle(styleAttr.value) : [];

  for (const prop of PAINT_PROPS) {
    const fromStyle = decls.find((d) => d.name === prop);
    const fromAttr = tag.attrs.find((a) => a.name === prop);
    const value = fromStyle?.value ?? fromAttr?.value;
    if (value !== undefined) paint.push({ prop, value });
  }
  return paint;
}

function writePaint(tag: Tag, paint: { prop: string; value: string }[]): void {
  const styleAttr = tag.attrs.find((a) => a.name === "style");
  const decls = (styleAttr ? parseStyle(styleAttr.value) : []).filter(
    (d) => !PAINT_PROPS.includes(d.name as (typeof PAINT_PROPS)[number]),
  );
  tag.attrs = tag.attrs.filter(
    (a) =>
      a.name !== "style" &&
      !PAINT_PROPS.includes(a.name as (typeof PAINT_PROPS)[number]),
  );

  const styled: Attr[] = [];
  for (const { prop, value } of paint) {
    if (value.includes("var(")) styled.push({ name: prop, value });
    else tag.attrs.push({ name: prop, value });
  }
  const allDecls = [...styled, ...decls];
  if (allDecls.length) {
    tag.attrs.push({
      name: "style",
      value: allDecls.map((d) => `${d.name}: ${d.value}`).join("; "),
    });
  }
}

function remap(hex: string, mode: CleanMode, distinct: Set<string>): string {
  if (mode === "disc") {
    return hex === DISC_LETTER ? "var(--grade-letter)" : "var(--grade-disc)";
  }
  if (distinct.size === 1) return "currentColor";
  const role = SWAP_ROLES[hex];
  if (!role) throw new Error(`unknown colour ${hex} in a multi-tone icon`);
  return role;
}

function serialise(tokens: Token[]): string {
  const lines: string[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === "close") depth--;
    const indent = "  ".repeat(Math.max(depth, 0));
    if (token.kind === "text") {
      lines.push(indent + token.text);
      continue;
    }
    if (token.kind === "close") {
      lines.push(`${indent}</${token.name}>`);
      continue;
    }
    const attrs = token.attrs
      .map((a) => ` ${a.name}="${a.value.replaceAll('"', "&quot;")}"`)
      .join("");
    lines.push(`${indent}<${token.name}${attrs}${token.kind === "self" ? "/>" : ">"}`);
    if (token.kind === "open") depth++;
  }
  return lines.join("\n") + "\n";
}

/**
 * Cleans one SVG document. Throws on input it can't handle safely (CDATA,
 * an unknown colour in `swap` mode). Idempotent: `cleanSvg(cleanSvg(x)) ===
 * cleanSvg(x)`.
 */
export function cleanSvg(source: string, mode: CleanMode): string {
  const keepIds = referencedIds(source);
  const input = tokenize(ensureViewBox(source));
  const output: Token[] = [];

  // Per open tag: whether it was dropped (unwrapped <g>) so its close goes too.
  const dropStack: boolean[] = [];
  let skipDepth = 0;
  let geometryDepth = 0;
  const painted: { tag: Tag; paint: { prop: string; value: string }[] }[] = [];

  for (const token of input) {
    if (skipDepth > 0) {
      if (token.kind === "open") skipDepth++;
      else if (token.kind === "close") skipDepth--;
      continue;
    }
    if (token.kind === "text") {
      output.push(token);
      continue;
    }
    if (token.kind === "close") {
      if (GEOMETRY_ELEMENTS.has(token.name)) geometryDepth--;
      if (!dropStack.pop()) output.push(token);
      continue;
    }
    if (DROPPED_ELEMENTS.has(token.name)) {
      if (token.kind === "open") skipDepth = 1;
      continue;
    }

    const isRoot = token.name === "svg" && output.length === 0;
    token.attrs = token.attrs.filter(
      (a) =>
        a.name !== "data-name" &&
        !(a.name === "id" && !keepIds.has(a.value)) &&
        !(isRoot && ROOT_DROPPED_ATTRS.has(a.name)),
    );

    const paint = collectPaint(token);
    if (paint.length) {
      writePaint(token, paint);
      if (geometryDepth === 0) painted.push({ tag: token, paint });
    }

    if (token.kind === "open") {
      if (GEOMETRY_ELEMENTS.has(token.name)) geometryDepth++;
      const unwrap = token.name === "g" && token.attrs.length === 0;
      dropStack.push(unwrap);
      if (unwrap) continue;
    } else if (token.name === "g" && token.attrs.length === 0) {
      continue;
    }
    output.push(token);
  }

  if (mode !== "keep") {
    const distinct = new Set<string>();
    for (const { paint } of painted) {
      for (const { value } of paint) {
        const hex = normaliseHex(value);
        if (hex) distinct.add(hex);
      }
    }
    for (const entry of painted) {
      entry.paint = entry.paint.map(({ prop, value }) => {
        const hex = normaliseHex(value);
        return { prop, value: hex ? remap(hex, mode, distinct) : value };
      });
      writePaint(entry.tag, entry.paint);
    }
  }

  return serialise(output);
}

/** Adds `viewBox` from the original `width` / `height` when it is missing. */
function ensureViewBox(source: string): string {
  const root = source.match(/<svg\b[^>]*>/);
  if (!root || /\bviewBox\s*=/.test(root[0])) return source;
  const attrs = parseAttrs(root[0]);
  const width = attrs.find((a) => a.name === "width")?.value;
  const height = attrs.find((a) => a.name === "height")?.value;
  if (!width || !height) throw new Error("root <svg> has no viewBox or size");
  const box = `viewBox="0 0 ${parseFloat(width)} ${parseFloat(height)}"`;
  return source.replace(root[0], root[0].replace(/^<svg\b/, `<svg ${box}`));
}

async function* svgFiles(path: string): AsyncGenerator<string> {
  if ((await stat(path)).isDirectory()) {
    for (const entry of await readdir(path)) yield* svgFiles(join(path, entry));
  } else if (path.endsWith(".svg")) {
    yield path;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (!targets.length) {
    console.error("usage: node scripts/clean-svg.mts [--check] <file-or-dir> [...]");
    process.exit(2);
  }

  let dirty = 0;
  let failed = 0;
  for (const target of targets) {
    for await (const file of svgFiles(target)) {
      const name = relative(process.cwd(), file).split(sep).join("/");
      const mode = modeFor(file);
      try {
        const before = await readFile(file, "utf8");
        const after = cleanSvg(before, mode);
        if (after === before) continue;
        dirty++;
        if (check) {
          console.log(`would clean ${name} (${mode})`);
        } else {
          await writeFile(file, after);
          console.log(
            `cleaned ${name} (${mode}) ${before.length} → ${after.length} B`,
          );
        }
      } catch (err) {
        failed++;
        console.error(`FAILED ${name}: ${(err as Error).message}`);
      }
    }
  }
  if (failed || (check && dirty)) process.exit(1);
}

if (import.meta.main) await main();
