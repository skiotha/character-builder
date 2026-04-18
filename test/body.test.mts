import { EventEmitter } from "node:events";
import { Buffer } from "node:buffer";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BodyTooLargeError,
  MAX_JSON_BODY,
  MAX_UPLOAD_BODY,
  readBody,
  readBodyBuffer,
} from "../src/lib/body.mts";

import type { IncomingMessage } from "node:http";

class MockRequest extends EventEmitter {
  destroyed = false;
  paused = false;
  destroy(): void {
    this.destroyed = true;
  }
  pause(): void {
    this.paused = true;
  }
}

function asReq(m: MockRequest): IncomingMessage {
  return m as unknown as IncomingMessage;
}

describe("readBody", () => {
  it("resolves with body string when under limit", async () => {
    const m = new MockRequest();
    const promise = readBody(asReq(m), 1024);
    setImmediate(() => {
      m.emit("data", Buffer.from("hello"));
      m.emit("data", Buffer.from(" world"));
      m.emit("end");
    });
    const result = await promise;
    assert.equal(result, "hello world");
    assert.equal(m.destroyed, false);
  });

  it("resolves with empty string for empty stream", async () => {
    const m = new MockRequest();
    const promise = readBody(asReq(m), 1024);
    setImmediate(() => m.emit("end"));
    assert.equal(await promise, "");
  });

  it("rejects with BodyTooLargeError when exceeding limit and pauses req", async () => {
    const m = new MockRequest();
    const promise = readBody(asReq(m), 4);
    setImmediate(() => {
      m.emit("data", Buffer.from("hello"));
    });
    await assert.rejects(promise, (err: Error) => {
      assert.ok(err instanceof BodyTooLargeError);
      assert.equal((err as BodyTooLargeError).limit, 4);
      return true;
    });
    assert.equal(m.paused, true);
    assert.equal(m.destroyed, false);
  });

  it("rejects when underlying stream errors", async () => {
    const m = new MockRequest();
    const promise = readBody(asReq(m), 1024);
    setImmediate(() => m.emit("error", new Error("boom")));
    await assert.rejects(promise, /boom/);
  });
});

describe("readBodyBuffer", () => {
  it("resolves with a Buffer", async () => {
    const m = new MockRequest();
    const promise = readBodyBuffer(asReq(m), 1024);
    setImmediate(() => {
      m.emit("data", Buffer.from([1, 2, 3]));
      m.emit("end");
    });
    const result = await promise;
    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual([...result], [1, 2, 3]);
  });
});

describe("constants", () => {
  it("MAX_JSON_BODY is 1 MB", () => {
    assert.equal(MAX_JSON_BODY, 1_048_576);
  });
  it("MAX_UPLOAD_BODY is 21 MB", () => {
    assert.equal(MAX_UPLOAD_BODY, 22_020_096);
  });
});
