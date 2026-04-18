import { Buffer } from "node:buffer";

import type { IncomingMessage } from "node:http";

const MAX_JSON_BODY = 1_048_576; // 1 MB
const MAX_UPLOAD_BODY = 22_020_096; // 21 MB (20 MB image + 1 MB multipart envelope)

class BodyTooLargeError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`Request body exceeds limit of ${limit} bytes`);
    this.name = "BodyTooLargeError";
    this.limit = limit;
  }
}

function collectBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      // Stop accumulating but DO NOT destroy the request: destroying tears
      // down the socket, preventing the caller from sending a 413 response
      // back to the client. Pause + drain instead — the caller is expected
      // to respond promptly, after which the connection closes cleanly.
      try {
        req.pause();
      } catch {
        /* ignore */
      }
      // Drain any remaining data silently so the parser stays happy if the
      // caller doesn't immediately end the response.
      req.on("data", () => {
        /* discard */
      });
      reject(err);
    };

    req.on("data", (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        fail(new BodyTooLargeError(maxBytes));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (err) => fail(err));
  });
}

async function readBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<string> {
  const buf = await collectBody(req, maxBytes);
  return buf.toString("utf8");
}

async function readBodyBuffer(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  return collectBody(req, maxBytes);
}

export {
  readBody,
  readBodyBuffer,
  BodyTooLargeError,
  MAX_JSON_BODY,
  MAX_UPLOAD_BODY,
};
