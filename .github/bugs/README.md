# Bug Trackers (`NB-N`)

Durable, in-tree notes on known bugs and design weaknesses, cited from code as
`NB-<n>`. Living in the repo keeps those citations greppable offline and lets
them resolve forever — including after a fix ships.

## Identifiers — the `NB-N` scheme

Every bug carries a single global identifier, `NB-<n>` ("Nagara Bug"), unique
across every file in this folder. The identifier is permanent and
location-independent: it is never reused or renumbered, and it never depends on
which file or severity a bug currently sits under. A bug keeps its id when it
moves between trackers, is re-triaged, or is archived, so an `NB-<n>` written in
a code comment resolves for good.

**Next unused id:** `NB-47` — recorded here and advanced as bugs are filed.

A code citation is a bare `NB-<n>` (no filename, no `#`). The
`test/bug-anchors.test.mts` lint checks that every cited id resolves to exactly
one entry and that no id is defined twice.

## How the bugs are organized

The identifier is the permanent part; the files are just buckets, and the set of
files is free to grow and shrink.

- **Open bugs** are grouped into *domain trackers*. No particular tracker is
  special or permanent: a new one can appear when a fresh area starts collecting
  bugs, and one that empties out can be retired. The current trackers are:

  | Tracker | Domain |
  | --- | --- |
  | [`engine.md`](engine.md) | RPG-engine logic and design weaknesses. |
  | [`infra.md`](infra.md) | API, HTTP, security, storage, validation. |

- **Closed bugs** are pooled into an archive — currently
  [`resolved.md`](resolved.md) — and kept rather than deleted, so a code comment
  that still cites a fixed bug keeps resolving.

Within an open tracker, bugs sit under a severity heading — `CRITICAL`, `HIGH`,
`MEDIUM`, `LOW`, or `DEFERRED`. Severity is only a heading, so re-triaging is an
in-place move; the archive carries no severity, which is meaningless once a bug
is closed.

## Lifecycle

A bug is **filed** under the next unused id, in whichever domain tracker fits (or
a new one, if none does), beneath the appropriate severity. Code that needs to
point at it carries a matching `// NB-<n>` comment; the open trackers imply the
domain by filename, so entries there need no domain tag.

A bug is **closed** in the same commit that fixes it: its status line is marked
resolved, and the whole entry moves to the archive, keeping its id and gaining a
`Domain:` tag. Archiving rather than deleting is deliberate — code comments go on
citing closed bugs to explain why the surrounding code looks the way it does.

## A note on history

These trackers were renamed and renumbered on 2026-06-21, when the earlier
per-file `engine-weak-points.md` / `api-infra-bugs.md` numbering had collided
across the two files. A handful of ids changed in the process; `git log
--follow` over this folder decodes any pre-migration `#<n>` reference that turns
up in history.
