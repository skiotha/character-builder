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

// ── magicAttribute / initiativeAttribute ─────────────────────
//
// Both fields are server-derived `PrimaryAttributeName` pointers consumed
// by sibling apps (Discord bot, addon) at roll time. They route through
// the `setBase` phase only; arithmetic modifiers, `appliesTo` predicates,
// and any modifier other than `setBase` are parser-rejected. Resolution
// uses `resolveSetBase` with the field default included in the
// max-by-primary comparison.

describe("magicAttribute", () => {
  it("defaults to 'resolute' with no effects", () => {
    const result = recalculate(makeTypedCharacter(), emptyRegistry);
    assert.equal(result.magicAttribute, "resolute");
  });

  it("accepts a single setBase override when the candidate's primary > default", () => {
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({ resolute: 10, appealing: 13 }),
      },
      effects: [
        {
          target: { kind: "magicAttribute" },
          modifier: { type: "setBase", value: "appealing" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.magicAttribute, "appealing");
  });

  it("keeps the default on a tie with the only candidate", () => {
    const char = makeTypedCharacter({
      // Both at 10 (defaults) → default wins.
      effects: [
        {
          target: { kind: "magicAttribute" },
          modifier: { type: "setBase", value: "appealing" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.magicAttribute, "resolute");
  });

  it("picks the highest of competing setBase candidates over the default", () => {
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({
          resolute: 10,
          appealing: 12,
          cunning: 15,
        }),
      },
      effects: [
        {
          target: { kind: "magicAttribute" },
          modifier: { type: "setBase", value: "appealing" },
        },
        {
          target: { kind: "magicAttribute" },
          modifier: { type: "setBase", value: "cunning" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.magicAttribute, "cunning");
  });

  it("resets to default on every recalc", () => {
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({ resolute: 10, appealing: 13 }),
      },
      // Pre-seed an off-default value and provide no overriding effect.
      magicAttribute: "appealing",
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.magicAttribute, "resolute");
  });

  it("rejects addFlat/multiply/cap on magicAttribute via the parser", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      for (const type of ["addFlat", "multiply", "cap"] as const) {
        const raw = {
          target: { kind: "magicAttribute" },
          modifier: { type, value: 1 },
        } as unknown as RawEffect;
        assert.equal(
          normalizeRawEffect(raw, "test"),
          null,
          `${type} on magicAttribute should be rejected`,
        );
      }
      assert.ok(warnMock.mock.callCount() >= 3);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("rejects setBase with a non-primary-attribute value", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw = {
        target: { kind: "magicAttribute" },
        modifier: { type: "setBase", value: "notAnAttribute" },
      } as unknown as RawEffect;
      assert.equal(normalizeRawEffect(raw, "test"), null);
      assert.ok(warnMock.mock.callCount() >= 1);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("strips appliesTo on magicAttribute targets with a warn", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      const raw: RawEffect = {
        target: { kind: "magicAttribute" },
        modifier: { type: "setBase", value: "appealing" },
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
});

describe("initiativeAttribute", () => {
  it("defaults to 'quick' with no effects", () => {
    const result = recalculate(makeTypedCharacter(), emptyRegistry);
    assert.equal(result.initiativeAttribute, "quick");
  });

  it("accepts a single setBase override when the candidate's primary > default", () => {
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({ quick: 10, cunning: 14 }),
      },
      effects: [
        {
          target: { kind: "initiativeAttribute" },
          modifier: { type: "setBase", value: "cunning" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.initiativeAttribute, "cunning");
  });

  it("keeps the default on a tie with the only candidate", () => {
    const char = makeTypedCharacter({
      effects: [
        {
          target: { kind: "initiativeAttribute" },
          modifier: { type: "setBase", value: "cunning" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.initiativeAttribute, "quick");
  });

  it("resets to default on every recalc", () => {
    const char = makeTypedCharacter({
      initiativeAttribute: "cunning",
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.initiativeAttribute, "quick");
  });

  it("rejects addFlat/multiply/cap on initiativeAttribute via the parser", () => {
    const warnMock = mock.method(console, "warn", () => {});
    try {
      for (const type of ["addFlat", "multiply", "cap"] as const) {
        const raw = {
          target: { kind: "initiativeAttribute" },
          modifier: { type, value: 1 },
        } as unknown as RawEffect;
        assert.equal(
          normalizeRawEffect(raw, "test"),
          null,
          `${type} on initiativeAttribute should be rejected`,
        );
      }
      assert.ok(warnMock.mock.callCount() >= 3);
    } finally {
      warnMock.mock.restore();
    }
  });

  it("magic and initiative resolve independently in one recalc", () => {
    const char = makeTypedCharacter({
      attributes: {
        primary: makePrimaryAttributes({
          resolute: 10,
          appealing: 14,
          quick: 10,
          cunning: 13,
        }),
      },
      effects: [
        {
          target: { kind: "magicAttribute" },
          modifier: { type: "setBase", value: "appealing" },
        },
        {
          target: { kind: "initiativeAttribute" },
          modifier: { type: "setBase", value: "cunning" },
        },
      ],
    });
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.magicAttribute, "appealing");
    assert.equal(result.initiativeAttribute, "cunning");
  });
});
