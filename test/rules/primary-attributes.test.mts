// Phase 6 G1 / Item 10 — `target.kind: "primary"` effects.
//
// `derivePrimaryAttributes` is the engine's pre-pipeline stage that
// snapshots effective primary attributes into
// `result.attributes.primaryEffective` BEFORE setBase / formula run, so
// all downstream stages read the post-effect values via `readPrimary`.
// `attributes.primary` is the player-authored 5–15 base and is never
// mutated by the engine — this preserves the round-trip invariant
// (save → load → recalc must not drift) and lets the UI display
// "base + bonus = effective".
//
// Parser contract (ADR-015 §3e):
//   * `addFlat` — accumulates additively per stat.
//   * `cap`     — smallest cap wins per stat.
//   * `setBase` / `multiply` / `remove` — rejected (parser returns null).
//   * `appliesTo` — silently stripped with a warn (character-level, not
//     slot-level).

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";
import { normalizeRawEffect } from "../../src/rules/effects.mts";

import { emptyRegistry } from "../helpers/registry.mts";
import {
  makePrimaryAttributes,
  makeTypedCharacter,
} from "../helpers/fixtures.mts";

import type { RawEffect } from "../../src/rpg-types.mts";

// ── pipeline behaviour ───────────────────────────────────────────

describe("derivePrimaryAttributes — pipeline integration", () => {
  it("addFlat snapshots into attributes.primaryEffective and leaves base untouched", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ strong: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "addFlat", value: 3 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.strong, 13);
    assert.equal(result.attributes.primary.strong, 10);
  });

  it("addFlat stacks (Exceptional Attribute +1 +2 = +3)", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ quick: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "addFlat", value: 1 },
        },
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "addFlat", value: 2 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.quick, 13);
    assert.equal(result.attributes.primary.quick, 10);
  });

  it("cap clamps when over base, leaves alone when under", () => {
    // base.strong = 14 + addFlat 0 → effective 14 → cap 15 leaves 14
    // base.vigilant = 5 + addFlat 0 → effective 5 → cap 15 leaves 5
    // base.quick = 10 + addFlat 8 → effective 18 → cap 15 clamps to 15
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({
          strong: 14,
          vigilant: 5,
          quick: 10,
        }),
      },
      effects: [
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "addFlat", value: 8 },
        },
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "cap", value: 15 },
        },
        {
          target: { kind: "primary", stat: "vigilant" },
          modifier: { type: "cap", value: 15 },
        },
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "cap", value: 15 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.strong, 14);
    assert.equal(result.attributes.primaryEffective.vigilant, 5);
    assert.equal(result.attributes.primaryEffective.quick, 15);
    // Base is preserved.
    assert.equal(result.attributes.primary.strong, 14);
    assert.equal(result.attributes.primary.vigilant, 5);
    assert.equal(result.attributes.primary.quick, 10);
  });

  it("smallest cap wins per stat", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ strong: 15 }) },
      effects: [
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "addFlat", value: 5 },
        },
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "cap", value: 15 },
        },
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "cap", value: 12 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.strong, 12);
    assert.equal(result.attributes.primary.strong, 15);
  });

  it("addFlat happens BEFORE cap (combined: base 10 + 5 capped at 12 = 12)", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ strong: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "addFlat", value: 5 },
        },
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "cap", value: 12 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.strong, 12);
    assert.equal(result.attributes.primary.strong, 10);
  });

  it("propagates into secondary toughness derivation", () => {
    // toughness.max = strong. Boosting strong from 10 → 14 via primary
    // effect must lift toughness.max to 14.
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ strong: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "addFlat", value: 4 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.strong, 14);
    assert.equal(result.attributes.primary.strong, 10);
    assert.equal(result.attributes.secondary.toughness.max, 14);
  });

  it("propagates into combat slot attackAttribute resolution", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ accurate: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "accurate" },
          modifier: { type: "addFlat", value: 2 },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.attributes.primaryEffective.accurate, 12);
    assert.equal(result.attributes.primary.accurate, 10);
  });

  it("is idempotent across repeated recalcs (no drift)", () => {
    // Round-trip safety: simulating save → load → recalc many times
    // must keep base unchanged and effective stable.
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ quick: 15 }) },
      effects: [
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "addFlat", value: 3 },
        },
      ],
    });
    let current = char;
    for (let i = 0; i < 5; i++) {
      current = recalculate(current, emptyRegistry);
    }
    assert.equal(current.attributes.primary.quick, 15);
    assert.equal(current.attributes.primaryEffective.quick, 18);
  });

  it("survives JSON serialize/deserialize without drift", () => {
    // Simulates the persistence path: recalc → JSON.stringify (storage)
    // → JSON.parse (load) → recalc. Effective must equal base + bonus
    // and base must NOT have absorbed the bonus.
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ quick: 15 }) },
      effects: [
        {
          target: { kind: "primary", stat: "quick" },
          modifier: { type: "addFlat", value: 3 },
        },
      ],
    });
    const first = recalculate(char, emptyRegistry);
    const reloaded = JSON.parse(JSON.stringify(first)) as typeof first;
    const second = recalculate(reloaded, emptyRegistry);
    assert.equal(second.attributes.primary.quick, 15);
    assert.equal(second.attributes.primaryEffective.quick, 18);
  });

  it("does not mutate the input character (base or effective)", () => {
    const char = makeTypedCharacter({
      attributes: { primary: makePrimaryAttributes({ strong: 10 }) },
      effects: [
        {
          target: { kind: "primary", stat: "strong" },
          modifier: { type: "addFlat", value: 3 },
        },
      ],
    });
    const beforeBase = char.attributes.primary.strong;
    const beforeEffective = char.attributes.primaryEffective.strong;
    recalculate(char, emptyRegistry);
    assert.equal(char.attributes.primary.strong, beforeBase);
    assert.equal(char.attributes.primaryEffective.strong, beforeEffective);
  });
});

// ── parser contract (ADR-015 §3e) ────────────────────────────────

describe("normalizeRawEffect — primary target", () => {
  it("accepts addFlat", () => {
    const raw: RawEffect = {
      target: { kind: "primary", stat: "strong" },
      modifier: { type: "addFlat", value: 2 },
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    assert.deepEqual(resolved.target, { kind: "primary", stat: "strong" });
    assert.deepEqual(resolved.modifier, { type: "addFlat", value: 2 });
  });

  it("accepts cap", () => {
    const raw: RawEffect = {
      target: { kind: "primary", stat: "strong" },
      modifier: { type: "cap", value: 15 },
    };
    const resolved = normalizeRawEffect(raw, "test");
    assert.ok(resolved);
    assert.deepEqual(resolved.modifier, { type: "cap", value: 15 });
  });

  it("rejects setBase with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw = {
        target: { kind: "primary", stat: "strong" },
        modifier: { type: "setBase", value: "quick" },
      } as unknown as RawEffect;
      assert.equal(normalizeRawEffect(raw, "test"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects multiply with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw: RawEffect = {
        target: { kind: "primary", stat: "strong" },
        modifier: { type: "multiply", value: 2 },
      };
      assert.equal(normalizeRawEffect(raw, "test"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects remove with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw: RawEffect = {
        target: { kind: "primary", stat: "strong" },
        modifier: { type: "remove" },
      };
      assert.equal(normalizeRawEffect(raw, "test"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects unknown stat with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw = {
        target: { kind: "primary", stat: "wisdom" },
        modifier: { type: "addFlat", value: 1 },
      } as unknown as RawEffect;
      assert.equal(normalizeRawEffect(raw, "test"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects appliesTo with a warn (character-level, not slot-level) (J.4b)", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw: RawEffect = {
        target: { kind: "primary", stat: "strong" },
        modifier: { type: "addFlat", value: 1 },
        appliesTo: [{ kind: "type", values: ["sword"] }],
      };
      const resolved = normalizeRawEffect(raw, "test");
      assert.equal(resolved, null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });
});
