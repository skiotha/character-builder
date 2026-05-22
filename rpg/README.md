---
tags:
  - meta
---

# Nagara RPG Rules Vault

This directory is an [Obsidian](https://obsidian.md/) vault that holds the
**canonical prose form** of the Nagara RPG rules — the full free-form
rule text, world lore, and exhaustive reference galleries — meant for
human reading and as the source of truth when authoring or revising
mechanics.

The vault is the prose companion to the machine-readable JSON catalogs
under [`../reference/`](../reference/) and the authoring spec at
[`../docs/reference-authoring.md`](../docs/reference-authoring.md).

## Layout

```
rpg/
├── _meta/
│   └── CHANGELOG.md          ← semver-style vault edit log
├── en/                       ← English content
│   └── index.md
├── ru/                       ← Russian content
│   ├── index.md
│   ├── 01-core/              ← foundational mechanics
│   ├── 02-lore/              ← world lore
│   └── 03-reference/         ← exhaustive galleries
├── .obsidian/                ← vault config (gitignored)
└── README.md                 ← this file
```

Section directories under each locale:

- **`01-core/`** — foundational mechanics: `first-rule`, `attributes`,
  `talents`, `traits`, `abilities`, `magic`, `equipment`, `battle-rules`.
- **`02-lore/`** — world lore (currently: `magic`).
- **`03-reference/`** — exhaustive per-topic galleries: `abilities`,
  `spells`, `boons`, `sins`, `rituals`, `weapons`, `armor`, `elixirs`,
  `utility`, `cost-of-life`.

## Locales

Both `en/` and `ru/` are first-class. The hard rule is that **they must
end up with the same content and structure** — same set of files, same
section headings, same wikilink graph; only the natural-language prose
differs.

At time of writing, `ru/` is the populated locale and `en/` contains
only an `index.md` stub marked `translation_status: WIP`. Until the
pre-release translation pass closes that gap, **author new prose in
`ru/` first**, then mirror the file shell into `en/` (with
`translation_status: WIP`) so the structural parity stays visible.
After EN is fully translated this restriction lifts — either locale
may be authored first.

The vault does **not** carry a parity lint; structural drift between
locales is allowed during the WIP period by design. (The JSON side
under `reference/` does enforce locale parity — see below.)

## Frontmatter convention

Every Markdown file (including section indexes) carries YAML
frontmatter. Required fields:

| Field                | Type    | Notes                                                |
| -------------------- | ------- | ---------------------------------------------------- |
| `title`              | string  | Human title; matches the top-level `#` heading.      |
| `lang`               | enum    | `ru` or `en`. Must match the parent locale dir.      |
| `slug`               | string  | Wikilink target; unique within a locale.             |
| `version`            | integer | Bumped on substantive edits to this note.            |
| `tags`               | list    | Free-form, but reuse existing tags where possible.   |
| `translation_status` | enum    | `complete` or `WIP`.                                 |
| `last_updated`       | date    | ISO `YYYY-MM-DD`.                                    |

Meta files (`README.md`, `_meta/CHANGELOG.md`) carry a minimal
`tags: [meta, ...]` frontmatter only.

## Wikilinks

Cross-references use Obsidian's `[[slug|display text]]` syntax and
resolve by the `slug` frontmatter field — not by filename. Wikilinks
are **locale-local**: a note in `ru/` may not link into `en/` (each
locale is its own resolution scope). When mirroring a file across
locales, the slugs are reused so the same wikilink works in both.

## Relationship to `reference/`

The vault is prose; [`../reference/`](../reference/) is the
engine-readable projection of the same content. The two sit in a
strict authority relationship:

- **`rpg/` is authoritative for rule intent.** When the JSON and the
  prose disagree, the JSON is wrong — fix the JSON.
- **`reference/*.json` is authoritative for wire shape.** The exact
  field layout consumed by the engine and sibling projects is
  specified in [`../docs/reference-authoring.md`](../docs/reference-authoring.md);
  the prose vault does not constrain it.

Not every vault topic is wired into the engine yet. `elixirs`,
`utility`, and `cost-of-life` are present as prose galleries but do
not yet have `reference/*.json` companions — their primary consumers
are the sibling projects (addon, Discord bot), and the JSON
projections will land alongside that integration work. The other
seven `03-reference/` topics (`abilities`, `spells`, `boons`, `sins`,
`rituals`, `weapons`, `armor`) all have JSON companions today,
plus the engine-internal `qualities` and `statuses` catalogs (which
have no standalone vault topic — see ADR-016 for `qualities`).

## Authoring workflow

1. **Open the vault in Obsidian** (`rpg/` is the vault root; the
   `.obsidian/` config is gitignored but Obsidian will recreate it
   locally on first open).
2. **Author the prose** in the appropriate locale dir. Reuse an
   existing file as a frontmatter and structural template. Cross-link
   freely with `[[slug]]`.
3. **Mirror the file shell** into the other locale with
   `translation_status: WIP` so the structural parity stays visible.
4. **If the change has mechanical impact**, project it into the
   matching `reference/<topic>.{en,ru}.json` catalog per
   [`../docs/reference-authoring.md`](../docs/reference-authoring.md).
   The JSON locale-drift lint
   (`test/reference-locale-drift.test.mts`) will fail loudly if you
   forget the second locale on the JSON side.
5. **Bump the changelog** at [`_meta/CHANGELOG.md`](_meta/CHANGELOG.md)
   for notable edits, following the existing semver entries.

## See also

- [`../docs/architecture.md`](../docs/architecture.md) §3.10 (RPG Rules Vault) and §3.11 (Reference Catalog)
- [`../docs/reference-authoring.md`](../docs/reference-authoring.md) — wire shape of every JSON catalog entry
- [`../reference/`](../reference/) — engine-readable JSON projection
- [`_meta/CHANGELOG.md`](_meta/CHANGELOG.md) — vault edit log
