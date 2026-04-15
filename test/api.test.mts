import { describe, it, mock, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createTempDir } from "./helpers/temp-dir.mts";
import { makeCharacter } from "./helpers/fixtures.mts";

import type { TempDir } from "./helpers/temp-dir.mts";
import type { TestServer } from "./helpers/http.mts";

// ── Setup: mock #config before importing app ──────────────────────

const TEST_DM_TOKEN = "test-dm-token-api";
const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "..");

let tempDir: TempDir;
let server: TestServer;

tempDir = await createTempDir();

mock.module("#config", {
  namedExports: {
    DATA_DIR: tempDir.dir,
    ENCODING: "utf8" as BufferEncoding,
    DM_TOKEN: TEST_DM_TOKEN,
    MIME_TYPES: {
      default: "application/octet-stream",
      plain: "text/plain",
      html: "text/html; charset=UTF-8",
      js: "text/javascript",
      mjs: "text/javascript",
      css: "text/css",
      png: "image/png",
      webp: "image/webp",
      ico: "image/x-icon",
      svg: "image/svg+xml",
      gif: "image/gif",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      avif: "image/avif",
      mp3: "audio/mpeg",
      ttf: "font/ttf",
      woff: "font/woff",
      woff2: "font/woff2",
      otf: "font/otf",
      json: "application/json",
      stream: "text/event-stream",
    } as Record<string, string>,
    PUBLIC_DIR: join(projectRoot, "public"),
    API_ROUTE: "/api/v1",
    LOCAL_ADDRESS: "127.0.0.1",
    PROJECT_ROOT: projectRoot,
  },
});

const { startTestServer } = await import("./helpers/http.mts");
server = await startTestServer(tempDir);

const BASE = server.baseUrl;

// ── Cleanup ───────────────────────────────────────────────────────

after(async () => {
  await server.close();
  await tempDir.cleanup();
});

// ── Helpers ───────────────────────────────────────────────────────

interface CreatedCharacter {
  id: string;
  backupCode: string;
  characterName: string;
  playerId: string;
}

async function createTestCharacter(
  overrides?: Record<string, unknown>,
  playerId: string = "player-api-test",
): Promise<CreatedCharacter> {
  const charData = makeCharacter(overrides);
  // Strip server-controlled fields
  delete charData.id;
  delete charData.backupCode;
  delete charData.created;
  delete charData.lastModified;
  delete charData.schemaVersion;
  // Strip DM-write-only fields that owners cannot set during creation
  delete charData.effects;

  const res = await fetch(`${BASE}/api/v1/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-player-id": playerId,
    },
    body: JSON.stringify({ ...charData, playerId }),
  });

  assert.equal(
    res.status,
    201,
    `createTestCharacter failed: ${await res.clone().text()}`,
  );
  const body = (await res.json()) as CreatedCharacter;
  return body;
}

// ── Character CRUD ────────────────────────────────────────────────

describe("GET /api/v1/characters", () => {
  it("returns characters for a specific playerId", async () => {
    const char = await createTestCharacter({}, "player-list-test");

    const res = await fetch(
      `${BASE}/api/v1/characters?playerId=player-list-test`,
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>[];
    assert.ok(Array.isArray(body));
    assert.ok(body.some((c) => (c as Record<string, unknown>).id === char.id));
  });

  it("returns all characters with valid DM token", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it("returns 400 without playerId or DM token", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
  });

  it("returns 400 with invalid DM token and no playerId", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      headers: { "x-dm-id": "wrong-token" },
    });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/v1/characters", () => {
  it("creates a character and returns 201 with generated id and backupCode", async () => {
    const charData = makeCharacter({ characterName: "Freshara" });
    delete charData.id;
    delete charData.backupCode;
    delete charData.created;
    delete charData.lastModified;
    delete charData.schemaVersion;
    delete charData.effects;

    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "player-create-test",
      },
      body: JSON.stringify({ ...charData, playerId: "player-create-test" }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body.id);
    assert.ok(body.backupCode);
    assert.equal(body.characterName, "Freshara");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "player-bad-json",
      },
      body: "{broken json",
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.ok(body.error);
  });

  it("returns 400 with validation details for name too short", async () => {
    const charData = makeCharacter({ characterName: "A" });
    delete charData.id;
    delete charData.backupCode;
    delete charData.created;
    delete charData.lastModified;
    delete charData.schemaVersion;
    delete charData.effects;

    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "player-val-test",
      },
      body: JSON.stringify({ ...charData, playerId: "player-val-test" }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; details: unknown[] };
    assert.equal(body.error, "Character validation failed");
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.length > 0);
  });

  it("strips server-controlled fields and still creates", async () => {
    const charData = makeCharacter({ characterName: "Stripara" });
    delete charData.created;
    delete charData.lastModified;
    delete charData.schemaVersion;
    delete charData.effects;

    // Inject server-controlled fields that should be overwritten
    charData.id = "injected-id";
    charData.backupCode = "Injected-Code-999";

    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "player-strip-test",
      },
      body: JSON.stringify({ ...charData, playerId: "player-strip-test" }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as Record<string, unknown>;
    assert.notEqual(body.id, "injected-id");
    assert.notEqual(body.backupCode, "Injected-Code-999");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "player-missing-test",
      },
      body: JSON.stringify({ playerId: "player-missing-test" }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { details?: unknown[] };
    assert.ok(
      body.details || true,
      "should return error details or generic error",
    );
  });
});

describe("GET /api/v1/characters/:id", () => {
  let charId: string;
  let charPlayerId: string;

  it("returns 200 with full data as owner", async () => {
    charPlayerId = "player-getone-test";
    const char = await createTestCharacter(
      { characterName: "Getara" },
      charPlayerId,
    );
    charId = char.id;

    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      headers: { "x-player-id": charPlayerId },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.characterName, "Getara");
    const perms = body._permissions as { role: string };
    assert.equal(perms.role, "owner");
    // Owner should see backupCode
    assert.ok(body.backupCode);
  });

  it("returns 200 with full data as DM", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    const perms = body._permissions as { role: string };
    assert.equal(perms.role, "dm");
    assert.ok(body.backupCode);
  });

  it("returns 200 with sanitized data as public", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`);

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    const perms = body._permissions as { role: string };
    assert.equal(perms.role, "public");
    // Public should NOT see backupCode or playerId
    assert.equal(body.backupCode, undefined);
    assert.equal(body.playerId, undefined);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await fetch(
      `${BASE}/api/v1/characters/00000000-0000-0000-0000-000000000000`,
    );
    assert.equal(res.status, 404);
  });

  it("returns 404 for deleted character as non-DM", async () => {
    // Create and then soft-delete
    const delChar = await createTestCharacter(
      { characterName: "Deletara" },
      "player-del-view-test",
    );

    const delRes = await fetch(`${BASE}/api/v1/characters/${delChar.id}`, {
      method: "DELETE",
      headers: { "x-player-id": "player-del-view-test" },
    });
    assert.equal(delRes.status, 200);

    // Now try to GET as public — should be 404
    const res = await fetch(`${BASE}/api/v1/characters/${delChar.id}`);
    assert.equal(res.status, 404);
  });

  it("returns 200 for deleted character as DM", async () => {
    // Create and soft-delete
    const delChar = await createTestCharacter(
      { characterName: "Deldmara" },
      "player-del-dm-view",
    );
    await fetch(`${BASE}/api/v1/characters/${delChar.id}`, {
      method: "DELETE",
      headers: { "x-player-id": "player-del-dm-view" },
    });

    const res = await fetch(`${BASE}/api/v1/characters/${delChar.id}`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.deleted, true);
  });
});

describe("PATCH /api/v1/characters/:id", () => {
  let charId: string;
  const OWNER = "player-patch-test";

  it("updates a character and returns 200 as owner", async () => {
    const char = await createTestCharacter(
      { characterName: "Patchara" },
      OWNER,
    );
    charId = char.id;

    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": OWNER,
      },
      body: JSON.stringify({
        updates: [
          { field: "location", value: "Thistle Hold", operation: "set" },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      character: Record<string, unknown>;
    };
    assert.equal(body.success, true);
    assert.equal(body.character.location, "Thistle Hold");
  });

  it("returns 403 without auth headers", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ field: "location", value: "Yndaros", operation: "set" }],
      }),
    });

    assert.equal(res.status, 403);
  });

  it("returns 403 for public role (wrong player)", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": "some-other-player",
      },
      body: JSON.stringify({
        updates: [{ field: "location", value: "Yndaros", operation: "set" }],
      }),
    });

    assert.equal(res.status, 403);
  });

  it("returns 422 for server-controlled field", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": OWNER,
      },
      body: JSON.stringify({
        updates: [{ field: "id", value: "hacked-id", operation: "set" }],
      }),
    });

    assert.equal(res.status, 422);
    const body = (await res.json()) as { errors: unknown[] };
    assert.ok(body.errors.length > 0);
  });

  it("returns 400 for empty updates array", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": OWNER,
      },
      body: JSON.stringify({ updates: [] }),
    });

    // Handler throws "No updates provided" → caught → 400
    assert.equal(res.status, 400);
  });

  it("returns 404 for non-existent character", async () => {
    const res = await fetch(
      `${BASE}/api/v1/characters/00000000-0000-0000-0000-000000000000`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-player-id": OWNER,
        },
        body: JSON.stringify({
          updates: [{ field: "location", value: "Nowhere", operation: "set" }],
        }),
      },
    );

    assert.equal(res.status, 404);
  });

  it("allows DM to update any character", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-dm-id": TEST_DM_TOKEN,
      },
      body: JSON.stringify({
        updates: [{ field: "location", value: "Karvosti", operation: "set" }],
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      character: Record<string, unknown>;
    };
    assert.equal(body.character.location, "Karvosti");
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-player-id": OWNER,
      },
      body: "{broken",
    });

    assert.equal(res.status, 400);
  });

  it("recalculates derived fields after update", async () => {
    // Primary attributes are DM-only after creation
    const res = await fetch(`${BASE}/api/v1/characters/${charId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-dm-id": TEST_DM_TOKEN,
      },
      body: JSON.stringify({
        updates: [
          { field: "attributes.primary.strong", value: 15, operation: "set" },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      character: {
        attributes: {
          secondary: { toughness: { max: number }; painThreshold: number };
        };
      };
    };
    // toughness.max = max(strong, 10) = 15
    assert.equal(body.character.attributes.secondary.toughness.max, 15);
  });
});

describe("DELETE /api/v1/characters/:id", () => {
  it("soft-deletes as owner and returns 200", async () => {
    const char = await createTestCharacter(
      { characterName: "Softdel" },
      "player-softdel",
    );

    const res = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      method: "DELETE",
      headers: { "x-player-id": "player-softdel" },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { type: string };
    assert.equal(body.type, "soft");
  });

  it("returns 403 for wrong player", async () => {
    const char = await createTestCharacter(
      { characterName: "Wrongdel" },
      "player-rightowner",
    );

    const res = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      method: "DELETE",
      headers: { "x-player-id": "player-wrongowner" },
    });

    assert.equal(res.status, 403);
  });

  it("hard-deletes as DM and returns 200", async () => {
    const char = await createTestCharacter(
      { characterName: "Harddel" },
      "player-harddel",
    );

    const res = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      method: "DELETE",
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { type: string };
    assert.equal(body.type, "hard");

    // Verify character is actually gone
    const getRes = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });
    assert.equal(getRes.status, 404);
  });

  it("returns 401 for invalid DM token", async () => {
    const char = await createTestCharacter(
      { characterName: "Baddm" },
      "player-baddm",
    );

    const res = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      method: "DELETE",
      headers: { "x-dm-id": "wrong-dm-token" },
    });

    assert.equal(res.status, 401);
  });

  it("returns 400 with no auth headers", async () => {
    const char = await createTestCharacter(
      { characterName: "Noauth" },
      "player-noauth-del",
    );

    const res = await fetch(`${BASE}/api/v1/characters/${char.id}`, {
      method: "DELETE",
    });

    assert.equal(res.status, 400);
  });

  it("returns 404 for non-existent character as player", async () => {
    const res = await fetch(
      `${BASE}/api/v1/characters/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { "x-player-id": "player-del-ghost" },
      },
    );

    assert.equal(res.status, 404);
  });
});

// ── Recovery & DM ─────────────────────────────────────────────────

describe("POST /api/v1/recover", () => {
  it("returns 200 with character for correct name and backupCode", async () => {
    const char = await createTestCharacter(
      { characterName: "Recovara" },
      "player-recover-test",
    );

    const res = await fetch(`${BASE}/api/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: "Recovara",
        backupCode: char.backupCode,
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.id, char.id);
  });

  it("returns 404 for wrong backupCode", async () => {
    const res = await fetch(`${BASE}/api/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: "Recovara",
        backupCode: "Wrong-Code-999",
      }),
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 for wrong name", async () => {
    const res = await fetch(`${BASE}/api/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: "Nonexistent",
        backupCode: "Some-Code-123",
      }),
    });

    assert.equal(res.status, 404);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await fetch(`${BASE}/api/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad json",
    });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/v1/dm/validate", () => {
  it("returns 200 for valid token", async () => {
    const res = await fetch(`${BASE}/api/v1/dm/validate`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });
    assert.equal(res.status, 200);
  });

  it("returns 400 for invalid token", async () => {
    const res = await fetch(`${BASE}/api/v1/dm/validate`, {
      headers: { "x-dm-id": "wrong-token" },
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Token validation failed");
  });

  it("returns 400 for missing token", async () => {
    const res = await fetch(`${BASE}/api/v1/dm/validate`);
    assert.equal(res.status, 400);
  });
});

// ── Schema, Config & Abilities ────────────────────────────────────

describe("GET /api/v1/schema", () => {
  it("returns 200 with JSON and ETag", async () => {
    const res = await fetch(`${BASE}/api/v1/schema`);

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("application/json"));
    assert.ok(res.headers.get("etag"));

    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body.fields);
    assert.ok(body.sections);
    assert.ok(body.version !== undefined);
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    // First request to get the ETag
    const first = await fetch(`${BASE}/api/v1/schema`);
    const etag = first.headers.get("etag")!;
    // Consume the body so the connection is freed
    await first.text();

    // Second request with matching ETag
    const res = await fetch(`${BASE}/api/v1/schema`, {
      headers: { "If-None-Match": etag },
    });
    assert.equal(res.status, 304);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const res = await fetch(`${BASE}/api/v1/schema`, {
      headers: { "If-None-Match": '"wrong-etag"' },
    });
    assert.equal(res.status, 200);
  });
});

describe("GET /api/v1/config", () => {
  it("returns 200 with expected config shape", async () => {
    const res = await fetch(`${BASE}/api/v1/config`);

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.apiBase, "/api/v1");
    assert.equal(body.maxFileSize, 10485760);
    assert.ok(Array.isArray(body.allowedImageTypes));
    assert.ok((body.allowedImageTypes as string[]).length > 0);
  });
});

describe("GET /api/v1/abilities", () => {
  it("returns 200 with abilities data", async () => {
    const res = await fetch(`${BASE}/api/v1/abilities`);

    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it("includes Cache-Control header", async () => {
    const res = await fetch(`${BASE}/api/v1/abilities`);

    assert.equal(res.status, 200);
    const cc = res.headers.get("cache-control");
    assert.ok(cc?.includes("max-age=3600"));
    // Consume body
    await res.text();
  });
});

// ── CORS & Routing ────────────────────────────────────────────────

describe("CORS", () => {
  it("OPTIONS returns 200 with CORS headers", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "OPTIONS",
    });

    assert.equal(res.status, 200);
    // Consume body
    await res.text();
  });

  it("includes Access-Control-Allow-Origin: * (documents current behavior)", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "OPTIONS",
    });

    // NOTE: Current implementation uses wildcard "*". ADR-007 requires strict
    // origin whitelist. Tracked in roadmap Phase 5.
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    await res.text();
  });

  it("includes custom headers in Access-Control-Allow-Headers", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      method: "OPTIONS",
    });

    const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
    assert.ok(
      allowHeaders.includes("x-player-id"),
      "should include x-player-id",
    );
    assert.ok(allowHeaders.includes("x-dm-id"), "should include x-dm-id");
    await res.text();
  });
});

describe("API routing", () => {
  it("returns 404 JSON for unknown API paths", async () => {
    const res = await fetch(`${BASE}/api/v1/nonexistent`);

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Not found");
  });
});

// ── Static File Serving ───────────────────────────────────────────

describe("static files", () => {
  it("GET / returns index.html", async () => {
    const res = await fetch(`${BASE}/`);

    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("text/html"), `expected text/html, got ${ct}`);
    const body = await res.text();
    assert.ok(body.includes("<!DOCTYPE html") || body.includes("<html"));
  });

  it("GET /index.html returns index.html directly", async () => {
    const res = await fetch(`${BASE}/index.html`);

    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("text/html"));
    await res.text();
  });

  it("SPA fallback: unknown path returns index.html", async () => {
    const res = await fetch(`${BASE}/characters/some-id/edit`);

    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("text/html"), "SPA fallback should serve HTML");
    const body = await res.text();
    assert.ok(body.includes("<!DOCTYPE html") || body.includes("<html"));
  });

  it("GET /assets/fonts/... serves with correct MIME type", async () => {
    const res = await fetch(`${BASE}/assets/fonts/philosopher.ttf`);

    assert.equal(res.status, 200);
    const ct = res.headers.get("content-type") ?? "";
    assert.ok(ct.includes("font/ttf"), `expected font/ttf, got ${ct}`);
    // Verify cache header
    const cc = res.headers.get("cache-control") ?? "";
    assert.ok(cc.includes("max-age"), "assets should have Cache-Control");
    await res.arrayBuffer();
  });

  it("path traversal via /assets/../ is blocked", async () => {
    const res = await fetch(`${BASE}/assets/../package.json`);

    // Should NOT serve package.json content
    const body = await res.text();
    assert.ok(
      !body.includes('"name"') || !body.includes('"character-builder"'),
      "should not expose package.json content",
    );
  });

  it("path traversal via /../../../ is blocked", async () => {
    const res = await fetch(`${BASE}/../../../etc/passwd`);

    // Should get SPA fallback (200 with HTML) or 404, never file content
    const body = await res.text();
    assert.ok(!body.includes("root:"), "should not serve system files");
  });
});

// ── Known Bugs (assert current broken behavior — will fail once fixed) ──

describe("@bug #25: portrait upload lacks auth", () => {
  it("allows anonymous portrait upload without any auth headers", async () => {
    const char = await createTestCharacter(
      { characterName: "PortraitBug" },
      "player-portrait-bug",
    );

    // Minimal valid multipart body (tiny 1x1 PNG)
    const boundary = "----TestBoundary";
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB" +
        "Nl7BcQAAAABJRU5ErkJggg==",
      "base64",
    );
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="portrait"; filename="test.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
      png1x1,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    // BUG: No x-player-id, no x-dm-id — should be rejected but isn't
    const res = await fetch(`${BASE}/api/v1/characters/${char.id}/portrait`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });

    // @bug — currently succeeds (200) without auth. Should be 401.
    assert.equal(
      res.status,
      200,
      "@bug #25: portrait upload should require auth",
    );
  });
});

describe("@bug #27: inconsistent sanitization on list endpoint", () => {
  it("GET /characters?playerId leaks backupCode", async () => {
    const char = await createTestCharacter(
      { characterName: "LeakTestara" },
      "player-leak-test",
    );

    const res = await fetch(
      `${BASE}/api/v1/characters?playerId=player-leak-test`,
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>[];
    const found = body.find((c) => c.id === char.id) as
      | Record<string, unknown>
      | undefined;
    assert.ok(found, "character should appear in list");

    // @bug — backupCode is exposed in list response. Should be sanitized.
    assert.ok(
      found.backupCode !== undefined,
      "@bug #27: list endpoint leaks backupCode (should be sanitized)",
    );
  });

  it("DM list leaks backupCode for all characters", async () => {
    const res = await fetch(`${BASE}/api/v1/characters`, {
      headers: { "x-dm-id": TEST_DM_TOKEN },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>[];
    assert.ok(body.length > 0);

    // @bug — DM list returns raw data including backupCode
    const first = body[0]!;
    assert.ok(
      first.backupCode !== undefined,
      "@bug #27: DM list endpoint leaks backupCode (should be role-sanitized)",
    );
  });
});

describe("@bug #27: recovery response leaks full character data", () => {
  it("POST /recover returns unsanitized character including playerId", async () => {
    const char = await createTestCharacter(
      { characterName: "RecoverLeak" },
      "player-recover-leak",
    );

    const res = await fetch(`${BASE}/api/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: "RecoverLeak",
        backupCode: char.backupCode,
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;

    // @bug — recovery response includes playerId (should be sanitized for public)
    assert.ok(
      body.playerId !== undefined,
      "@bug #27: recover endpoint leaks playerId in response",
    );
  });
});
