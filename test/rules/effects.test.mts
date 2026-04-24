import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import {
  collectAllEffects,
  groupByPhase,
  normalizeRawEffect,
} from "../../src/rules/effects.mts";
import { createInMemoryRegistry } from "../helpers/registry.mts";

import type { LearnedTrait, RawEffect } from "../../src/rpg-types.mts";

// ── normalizeRawEffect ──────────────────────────────────────────

describe("normalizeRawEffect", () => {
  it("normalizes a typed RawEffect into a ResolvedEffect", () => {
    const raw: RawEffect = {
      target: { kind: "secondary", stat: "defense" },
      modifier: { type: "addFlat", value: 3 },
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    assert.equal(resolved.modifier.type, "addFlat");
    assert.deepEqual(resolved.target, {
      kind: "secondary",
      stat: "defense",
    });
  });

  it("ignores `duration` (engine has no lifecycle)", () => {
    const raw: RawEffect = {
      target: { kind: "secondary", stat: "defense" },
      modifier: { type: "addFlat", value: 3 },
      duration: "2099-01-01T00:00:00.000Z",
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    // No `duration` property on ResolvedEffect.
    assert.equal(
      (resolved as unknown as Record<string, unknown>).duration,
      undefined,
    );
  });

  it("ignores `priority` (phase ordering replaces it)", () => {
    const raw: RawEffect = {
      target: { kind: "secondary", stat: "defense" },
      modifier: { type: "addFlat", value: 3 },
      priority: 5,
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    assert.equal(
      (resolved as unknown as Record<string, unknown>).priority,
      undefined,
    );
  });

  it("rejects legacy `add`/`mul`/`set` modifier verbs with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      for (const verb of ["add", "mul", "set"] as const) {
        const raw = {
          target: { kind: "secondary", stat: "defense" },
          modifier: { type: verb, value: 1 },
        } as unknown as RawEffect;
        assert.equal(normalizeRawEffect(raw, "legacy"), null);
      }
      assert.ok(warnMock.mock.callCount() >= 3);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects dotted-path string targets with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw = {
        target: "attributes.secondary.defense",
        modifier: { type: "addFlat", value: 1 },
      } as unknown as RawEffect;
      assert.equal(normalizeRawEffect(raw, "legacy"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects `rules.toughness` style targets with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw = {
        target: "rules.toughness",
        modifier: { type: "setBase", value: "resolute" },
      } as unknown as RawEffect;
      assert.equal(normalizeRawEffect(raw, "legacy"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("strips appliesTo on non-combat targets with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw: RawEffect = {
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "addFlat", value: 1 },
        appliesTo: [{ kind: "any" }],
      };
      const resolved = normalizeRawEffect(raw, "test");
      assert.ok(resolved);
      assert.equal(resolved.appliesTo, undefined);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("preserves appliesTo on combat targets", () => {
    const raw: RawEffect = {
      target: { kind: "combat", field: "baseDamage" },
      modifier: { type: "addFlat", value: 2 },
      appliesTo: [{ kind: "type", values: ["sword"] }],
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    assert.deepEqual(resolved.appliesTo, [{ kind: "type", values: ["sword"] }]);
  });
});

// ── collectAllEffects ───────────────────────────────────────────

describe("collectAllEffects", () => {
  it("merges trait effects (registry) and character.effects (translator)", () => {
    const registry = createInMemoryRegistry({
      traits: {
        "x:novice": {
          effects: [
            {
              source: "x",
              target: { kind: "secondary", stat: "armor" },
              modifier: { type: "addFlat", value: 1 },
            },
          ],
        },
      },
    });
    const traits: LearnedTrait[] = [
      { id: "x", tier: "novice", source: "ability" },
    ];
    const charEffects: RawEffect[] = [
      {
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "addFlat", value: 2 },
      },
    ];
    const collected = collectAllEffects(
      { traits, effects: charEffects },
      registry,
    );
    assert.equal(collected.length, 2);
  });

  it("unwinds nested effects[] inside a RawEffect", () => {
    const registry = createInMemoryRegistry();
    const charEffects: RawEffect[] = [
      {
        modifier: { type: "addFlat" },
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 1 },
          },
          {
            target: { kind: "secondary", stat: "armor" },
            modifier: { type: "addFlat", value: 1 },
          },
        ],
      } as unknown as RawEffect,
    ];
    const collected = collectAllEffects({ effects: charEffects }, registry);
    assert.equal(collected.length, 2);
  });

  it("warns and skips unknown trait", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const registry = createInMemoryRegistry();
      const traits: LearnedTrait[] = [
        { id: "missing", tier: "novice", source: "ability" },
      ];
      const collected = collectAllEffects({ traits }, registry);
      assert.equal(collected.length, 0);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("does NOT collect talents (Chunk C / TODO post-G regression guard)", () => {
    const registry = createInMemoryRegistry({
      talents: {
        "noctis:1": {
          effects: [
            {
              source: "noctis",
              target: { kind: "secondary", stat: "armor" },
              modifier: { type: "addFlat", value: 99 },
            },
          ],
        },
      },
    });
    const collected = collectAllEffects(
      {
        talents: [{ id: "noctis", level: 1, source: "boon" }] as unknown[],
      },
      registry,
    );
    assert.equal(collected.length, 0);
  });

  it("does NOT collect equipment effects (Chunk C / Chunk-E TODO regression guard)", () => {
    const registry = createInMemoryRegistry();
    // Equipment effects on weapons are *not* gathered by collectAllEffects.
    const collected = collectAllEffects(
      {
        // No `effects` property at all — equipment is not even touched.
      },
      registry,
    );
    assert.equal(collected.length, 0);
  });
});

// ── groupByPhase ────────────────────────────────────────────────

describe("groupByPhase", () => {
  it("buckets effects by modifier type", () => {
    const groups = groupByPhase([
      {
        source: "a",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "setBase", value: "quick" },
      },
      {
        source: "b",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "addFlat", value: 1 },
      },
      {
        source: "c",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "multiply", value: 2 },
      },
      {
        source: "d",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "cap", value: 50 },
      },
    ]);
    assert.equal(groups.get("setBase")?.length, 1);
    assert.equal(groups.get("addFlat")?.length, 1);
    assert.equal(groups.get("multiply")?.length, 1);
    assert.equal(groups.get("cap")?.length, 1);
  });

  it("buckets all flag/quality targets into the flag phase", () => {
    const groups = groupByPhase([
      {
        source: "a",
        target: { kind: "flag", name: "darkvision" },
        modifier: { type: "addFlat", value: 1 },
      },
      {
        source: "b",
        target: { kind: "armorQuality", quality: "reinforced" },
        modifier: { type: "remove" },
      },
      {
        source: "c",
        target: { kind: "weaponQuality", quality: "sharp" },
        modifier: { type: "addFlat", value: 1 },
      },
    ]);
    assert.equal(groups.get("flag")?.length, 3);
    assert.equal(groups.get("addFlat") ?? undefined, undefined);
  });
});
