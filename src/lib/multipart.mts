import { Buffer } from "node:buffer";
import Stream from "node:stream";

import { MAX_UPLOAD_BODY, readBodyBuffer } from "./body.mts";

import type { IncomingMessage } from "node:http";
import type { ParsedImage } from "#types";

export async function parseImage(
  req: IncomingMessage,
  boundary: string,
): Promise<ParsedImage> {
  const buffer = await readBodyBuffer(req, MAX_UPLOAD_BODY);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

  const startIdx = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
  const endIdx = buffer.indexOf(endBoundaryBuffer);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Invalid image data");
  }

  const fileSection = buffer.subarray(startIdx, endIdx);

  const headerEnd = fileSection.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    throw new Error("No file headers found");
  }

  const headers = fileSection.subarray(0, headerEnd).toString();
  const filenameMatch = headers.match(/filename="([^"]+)"/);
  const filename = filenameMatch ? filenameMatch[1]! : "upload.jpg";

  const fileContent = fileSection.subarray(headerEnd + 4);

  return {
    filename,
    stream: Stream.Readable.from(fileContent),
  };
}
