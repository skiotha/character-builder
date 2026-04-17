import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  addClient,
  removeClient,
  broadcastToCharacter,
  _resetForTesting,
} from "#sse";
import { createMockResponse } from "./helpers/mock-response.mts";

import type { ServerResponse } from "node:http";

// ── Suppress SSE console output during tests ──────────────────────

mock.method(console, "info", () => {});
mock.method(console, "error", () => {});
mock.method(console, "log", () => {});

// ── Helpers ───────────────────────────────────────────────────────

function asRes(mockRes: ReturnType<typeof createMockResponse>): ServerResponse {
  return mockRes as unknown as ServerResponse;
}

// ── Tests ─────────────────────────────────────────────────────────

describe("broadcast", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  // ── addClient ─────────────────────────────────────────────────

  describe("addClient", () => {
    it("added client receives subsequent broadcasts", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);

      broadcastToCharacter("char-1", { name: "Test" });

      assert.equal(res.written.length, 1);
      assert.ok(res.written[0]!.startsWith("event: character-updated\n"));
    });

    it("adds multiple clients for the same character", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      addClient("char-1", asRes(res1), "player-1", false);
      addClient("char-1", asRes(res2), "player-2", false);

      broadcastToCharacter("char-1", { name: "Test" });

      assert.equal(res1.written.length, 1);
      assert.equal(res2.written.length, 1);
    });

    it("isolates clients for different characters", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      addClient("char-1", asRes(res1), "player-1", false);
      addClient("char-2", asRes(res2), "player-2", false);

      broadcastToCharacter("char-1", { name: "Test" });

      assert.equal(res1.written.length, 1);
      assert.equal(res2.written.length, 0);
    });

    it("registers a close handler on the response", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);

      // The mock stores handlers — verify 'close' was registered
      // Trigger close and verify the client is removed (no broadcast reaches it)
      res.trigger("close");

      broadcastToCharacter("char-1", { name: "Test" });
      assert.equal(res.written.length, 0);
    });

    it("auto-removes client when close event fires", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      addClient("char-1", asRes(res1), "player-1", false);
      addClient("char-1", asRes(res2), "player-2", false);

      res1.trigger("close");

      broadcastToCharacter("char-1", { name: "Test" });
      assert.equal(res1.written.length, 0);
      assert.equal(res2.written.length, 1);
    });
  });

  // ── removeClient ──────────────────────────────────────────────

  describe("removeClient", () => {
    it("removed client no longer receives broadcasts", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);
      removeClient("char-1", asRes(res));

      broadcastToCharacter("char-1", { name: "Test" });
      assert.equal(res.written.length, 0);
    });

    it("cleans up map entry when last client is removed", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);
      removeClient("char-1", asRes(res));

      // Broadcast should be a no-op — verify no crash
      broadcastToCharacter("char-1", { name: "Test" });
      assert.equal(res.written.length, 0);
    });

    it("does not crash when removing from non-existent character", () => {
      const res = createMockResponse();
      assert.doesNotThrow(() => {
        removeClient("no-such-char", asRes(res));
      });
    });

    it("does not crash when removing non-existent res reference", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      addClient("char-1", asRes(res1), "player-1", false);

      // Remove a res that was never added — should not crash or affect res1
      removeClient("char-1", asRes(res2));

      broadcastToCharacter("char-1", { name: "Test" });
      assert.equal(res1.written.length, 1);
    });

    it("does not crash when map is empty", () => {
      const res = createMockResponse();
      assert.doesNotThrow(() => {
        removeClient("char-1", asRes(res));
      });
    });
  });

  // ── broadcastToCharacter ──────────────────────────────────────

  describe("broadcastToCharacter", () => {
    it("sends SSE-formatted event to a single client", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);

      broadcastToCharacter("char-1", { name: "Testara" });

      assert.equal(res.written.length, 1);
      const msg = res.written[0]!;
      assert.ok(msg.startsWith("event: character-updated\ndata: "));
      assert.ok(msg.endsWith("\n\n"));
    });

    it("sends identical event to all clients", () => {
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const res3 = createMockResponse();
      addClient("char-1", asRes(res1), "p1", false);
      addClient("char-1", asRes(res2), "p2", false);
      addClient("char-1", asRes(res3), undefined, true);

      broadcastToCharacter("char-1", { name: "Testara" });

      assert.equal(res1.written[0], res2.written[0]);
      assert.equal(res2.written[0], res3.written[0]);
    });

    it("is a no-op when no clients exist for character", () => {
      assert.doesNotThrow(() => {
        broadcastToCharacter("no-clients", { name: "Ghost" });
      });
    });

    it("event data contains type, character, and timestamp", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);

      const charData = { name: "Testara", level: 3 };
      broadcastToCharacter("char-1", charData);

      const msg = res.written[0]!;
      const jsonStr = msg
        .replace("event: character-updated\ndata: ", "")
        .replace(/\n\n$/, "");
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      assert.equal(parsed.type, "character-updated");
      assert.deepStrictEqual(parsed.character, charData);
      assert.ok(typeof parsed.timestamp === "string");
    });

    it("timestamp is a valid ISO string", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "player-1", false);

      broadcastToCharacter("char-1", { name: "Test" });

      const msg = res.written[0]!;
      const jsonStr = msg
        .replace("event: character-updated\ndata: ", "")
        .replace(/\n\n$/, "");
      const parsed = JSON.parse(jsonStr) as { timestamp: string };
      const date = new Date(parsed.timestamp);
      assert.ok(!isNaN(date.getTime()), "timestamp should be a valid date");
      assert.equal(parsed.timestamp, date.toISOString());
    });

    it("removes client whose write() throws and delivers to others", () => {
      const failing = createMockResponse();
      const healthy = createMockResponse();
      addClient("char-1", asRes(failing), "p1", false);
      addClient("char-1", asRes(healthy), "p2", false);

      failing.throwOnWrite = true;

      broadcastToCharacter("char-1", { name: "Test" });

      // Healthy client received the event
      assert.equal(healthy.written.length, 1);

      // Failing client was removed — second broadcast should not reach it
      failing.throwOnWrite = false;
      broadcastToCharacter("char-1", { name: "Test2" });
      assert.equal(failing.written.length, 0);
      assert.equal(healthy.written.length, 2);
    });

    it("handles mutation-during-iteration: first client throws, second still receives", () => {
      // Set.forEach is safe to delete during iteration — deleted entries
      // that haven't been visited yet are still visited. But removeClient
      // deletes the failing entry, which has already been visited, so the
      // remaining entries proceed normally.
      const first = createMockResponse();
      const second = createMockResponse();
      addClient("char-1", asRes(first), "p1", false);
      addClient("char-1", asRes(second), "p2", false);

      first.throwOnWrite = true;

      broadcastToCharacter("char-1", { name: "Test" });

      assert.equal(second.written.length, 1);
    });

    // ── per-subscriber sanitization ───────────────────────────

    function parseEvent(msg: string): {
      character: Record<string, unknown>;
    } {
      const jsonStr = msg
        .replace("event: character-updated\ndata: ", "")
        .replace(/\n\n$/, "");
      return JSON.parse(jsonStr) as { character: Record<string, unknown> };
    }

    it("strips backupCode/playerId for public subscriber", () => {
      const res = createMockResponse();
      // Anonymous subscriber: no playerId, not DM → public role
      addClient("char-1", asRes(res), undefined, false);

      broadcastToCharacter("char-1", {
        name: "Testara",
        playerId: "owner-1",
        backupCode: "secret-code",
      });

      const { character } = parseEvent(res.written[0]!);
      assert.equal(character.backupCode, undefined);
      assert.equal(character.playerId, undefined);
      assert.equal(character.name, "Testara");
    });

    it("preserves backupCode/playerId for owner subscriber", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), "owner-1", false);

      broadcastToCharacter("char-1", {
        name: "Testara",
        playerId: "owner-1",
        backupCode: "secret-code",
      });

      const { character } = parseEvent(res.written[0]!);
      assert.equal(character.backupCode, "secret-code");
      assert.equal(character.playerId, "owner-1");
    });

    it("preserves backupCode/playerId for DM subscriber", () => {
      const res = createMockResponse();
      addClient("char-1", asRes(res), undefined, true);

      broadcastToCharacter("char-1", {
        name: "Testara",
        playerId: "owner-1",
        backupCode: "secret-code",
      });

      const { character } = parseEvent(res.written[0]!);
      assert.equal(character.backupCode, "secret-code");
      assert.equal(character.playerId, "owner-1");
    });

    it("does not cross-contaminate: owner, DM, and public all get correct payloads", () => {
      const ownerRes = createMockResponse();
      const dmRes = createMockResponse();
      const publicRes = createMockResponse();
      addClient("char-1", asRes(ownerRes), "owner-1", false);
      addClient("char-1", asRes(dmRes), undefined, true);
      addClient("char-1", asRes(publicRes), "other-player", false);

      broadcastToCharacter("char-1", {
        name: "Testara",
        playerId: "owner-1",
        backupCode: "secret-code",
      });

      const owner = parseEvent(ownerRes.written[0]!).character;
      const dm = parseEvent(dmRes.written[0]!).character;
      const pub = parseEvent(publicRes.written[0]!).character;

      assert.equal(owner.backupCode, "secret-code");
      assert.equal(dm.backupCode, "secret-code");
      assert.equal(pub.backupCode, undefined);
      assert.equal(pub.playerId, undefined);
    });

    it("does not mutate the broadcast payload across subscribers", () => {
      const publicRes = createMockResponse();
      const ownerRes = createMockResponse();
      addClient("char-1", asRes(publicRes), undefined, false);
      addClient("char-1", asRes(ownerRes), "owner-1", false);

      const payload = {
        name: "Testara",
        playerId: "owner-1",
        backupCode: "secret-code",
      };
      broadcastToCharacter("char-1", payload);

      // Original payload untouched
      assert.equal(payload.backupCode, "secret-code");
      assert.equal(payload.playerId, "owner-1");

      // Owner still gets full payload (regression for the mutation bug)
      const owner = parseEvent(ownerRes.written[0]!).character;
      assert.equal(owner.backupCode, "secret-code");
      assert.equal(owner.playerId, "owner-1");
    });
  });
});
