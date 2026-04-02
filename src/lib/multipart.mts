import { Buffer } from "node:buffer";
import Stream from "node:stream";
import type { IncomingMessage } from "node:http";
import type { ParsedImage } from "#types";

export function parseImage(
  req: IncomingMessage,
  boundary: string,
): Promise<ParsedImage> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];

    req.on("data", (chunk: Buffer) => buffers.push(chunk));

    req.on("end", () => {
      const buffer = Buffer.concat(buffers);
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

      const startIdx =
        buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2;
      const endIdx = buffer.indexOf(endBoundaryBuffer);

      if (startIdx === -1 || endIdx === -1) {
        reject(new Error("Invalid image data"));
        return;
      }

      // @TODO: dangerous probably
      const fileSection = buffer.subarray(startIdx, endIdx);

      const headerEnd = fileSection.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        reject(new Error("No file headers found"));
        return;
      }

      const headers = fileSection.subarray(0, headerEnd).toString();
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1]! : "upload.jpg";

      const fileContent = fileSection.subarray(headerEnd + 4);

      resolve({
        filename,
        stream: Stream.Readable.from(fileContent),
      });
    });

    req.on("error", reject);
  });
}
