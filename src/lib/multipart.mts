import { Buffer } from "node:buffer";
import Stream from "node:stream";

export function parseImage(req, boundary) {
  return new Promise((resolve, reject) => {
    let buffers = [];
    let fileData = null;

    req.on("data", (chunk) => buffers.push(chunk));

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
      const fileSection = buffer.slice(startIdx, endIdx);

      const headerEnd = fileSection.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        reject(new Error("No file headers found"));
        return;
      }

      const headers = fileSection.slice(0, headerEnd).toString();
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "upload.jpg";

      const fileContent = fileSection.slice(headerEnd + 4);

      resolve({
        filename,
        stream: Stream.Readable.from(fileContent),
      });
    });

    req.on("error", reject);
  });
}
