import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseLocale } from "../src/lib/locale.mts";

import type { IncomingMessage } from "node:http";

function makeReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function makeUrl(query = ""): URL {
  return new URL(`http://localhost/api/v1/traits${query}`);
}

describe("parseLocale", () => {
  it("returns the query parameter when valid", () => {
    const result = parseLocale(makeReq(), makeUrl("?locale=ru"));
    assert.equal(result, "ru");
  });

  it("normalizes case in query parameter", () => {
    const result = parseLocale(makeReq(), makeUrl("?locale=EN"));
    assert.equal(result, "en");
  });

  it("returns an error object for an unsupported query locale", () => {
    const result = parseLocale(makeReq(), makeUrl("?locale=fr"));
    assert.deepEqual(typeof result === "object" ? result : null, {
      error: "Unsupported locale: 'fr'. Supported: en, ru.",
    });
  });

  it("falls back to Accept-Language when no query parameter", () => {
    const req = makeReq({ "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" });
    const result = parseLocale(req, makeUrl());
    assert.equal(result, "ru");
  });

  it("ignores quality factors and uses header order", () => {
    // First match wins regardless of q-values.
    const req = makeReq({ "accept-language": "en-US;q=0.5,ru;q=0.9" });
    const result = parseLocale(req, makeUrl());
    assert.equal(result, "en");
  });

  it("skips unsupported tags in Accept-Language", () => {
    const req = makeReq({ "accept-language": "fr-FR,de;q=0.9,ru;q=0.8" });
    const result = parseLocale(req, makeUrl());
    assert.equal(result, "ru");
  });

  it("falls back to default when nothing matches", () => {
    const req = makeReq({ "accept-language": "fr-FR,de" });
    const result = parseLocale(req, makeUrl());
    assert.equal(result, "en");
  });

  it("falls back to default when no header and no query", () => {
    const result = parseLocale(makeReq(), makeUrl());
    assert.equal(result, "en");
  });

  it("query parameter overrides Accept-Language", () => {
    const req = makeReq({ "accept-language": "ru" });
    const result = parseLocale(req, makeUrl("?locale=en"));
    assert.equal(result, "en");
  });
});
