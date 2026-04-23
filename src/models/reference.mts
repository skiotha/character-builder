import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { ENCODING, REFERENCE_DIR } from "#config";

import type { Locale } from "#config";

interface ReferenceEntry {
  id: string;
  source?: string;
  [key: string]: unknown;
}

const SINGLE_TOPICS = ["rituals", "weapons", "armor"] as const;
type SingleTopic = (typeof SINGLE_TOPICS)[number];

const MERGED_TOPICS = ["traits", "talents"] as const;
type MergedTopic = (typeof MERGED_TOPICS)[number];

/**
 * Components of each merged endpoint and the `source` value to stamp on
 * entries. Order is meaningful only for the id-uniqueness error message;
 * results are concatenated in the order listed.
 */
const MERGED_COMPONENTS: Record<
  MergedTopic,
  ReadonlyArray<{ topic: string; source: string }>
> = {
  traits: [
    { topic: "abilities", source: "ability" },
    { topic: "spells", source: "spell" },
  ],
  talents: [
    { topic: "boons", source: "boon" },
    { topic: "sins", source: "sin" },
  ],
};

interface CacheEntry {
  entries: ReferenceEntry[];
  mtimeMs: number;
}

const singleCache = new Map<string, CacheEntry>();
const mergedCache = new Map<string, CacheEntry>();

function fileFor(topic: string, locale: Locale): string {
  return join(REFERENCE_DIR, `${topic}.${locale}.json`);
}

async function loadFile(
  topic: string,
  locale: Locale,
): Promise<{ entries: ReferenceEntry[]; mtimeMs: number }> {
  const filePath = fileFor(topic, locale);
  const stats = await stat(filePath);
  const data = await readFile(filePath, ENCODING);
  const parsed = JSON.parse(data) as ReferenceEntry[];
  return { entries: parsed, mtimeMs: stats.mtimeMs };
}

/**
 * Read a single-source reference topic (rituals, weapons, armor).
 * Cached per (topic, locale) and invalidated by mtime.
 */
async function getTopic(
  topic: SingleTopic,
  locale: Locale,
): Promise<ReferenceEntry[]> {
  const key = `${topic}:${locale}`;
  const stats = await stat(fileFor(topic, locale));
  const cached = singleCache.get(key);
  if (cached && cached.mtimeMs >= stats.mtimeMs) {
    return cached.entries;
  }

  const loaded = await loadFile(topic, locale);
  singleCache.set(key, loaded);
  console.log(`[Reference] Cache updated: ${topic}.${locale}`);
  return loaded.entries;
}

/**
 * Read a merged endpoint (traits = abilities+spells, talents = boons+sins).
 * Stamps `source` on each entry; throws if any id collides across the
 * components — error names both source files so authoring mistakes are
 * caught immediately.
 */
async function getMerged(
  merged: MergedTopic,
  locale: Locale,
): Promise<ReferenceEntry[]> {
  const components = MERGED_COMPONENTS[merged];
  const key = `${merged}:${locale}`;

  // Check freshness: every component must be at-or-older than the cache.
  const stats = await Promise.all(
    components.map((c) => stat(fileFor(c.topic, locale))),
  );
  const newestMtime = Math.max(...stats.map((s) => s.mtimeMs));
  const cached = mergedCache.get(key);
  if (cached && cached.mtimeMs >= newestMtime) {
    return cached.entries;
  }

  const loadedComponents = await Promise.all(
    components.map(async (c) => {
      const { entries } = await loadFile(c.topic, locale);
      return { topic: c.topic, source: c.source, entries };
    }),
  );

  const seen = new Map<string, string>(); // id -> first topic that defined it
  const merged_entries: ReferenceEntry[] = [];
  for (const comp of loadedComponents) {
    for (const entry of comp.entries) {
      if (!entry.id) {
        throw new Error(
          `[Reference] Entry without id in reference/${comp.topic}.${locale}.json`,
        );
      }
      const prior = seen.get(entry.id);
      if (prior !== undefined) {
        throw new Error(
          `[Reference] Duplicate id '${entry.id}' across reference/${prior}.${locale}.json and reference/${comp.topic}.${locale}.json`,
        );
      }
      seen.set(entry.id, comp.topic);
      merged_entries.push({ ...entry, source: comp.source });
    }
  }

  mergedCache.set(key, { entries: merged_entries, mtimeMs: newestMtime });
  console.log(`[Reference] Cache updated: ${merged}.${locale}`);
  return merged_entries;
}

export { getTopic, getMerged, SINGLE_TOPICS, MERGED_TOPICS };
export type { ReferenceEntry, SingleTopic, MergedTopic };
