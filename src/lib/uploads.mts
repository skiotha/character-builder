import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { DATA_DIR } from "#config";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

await fsp.mkdir(path.join(UPLOAD_DIR, "portraits"), { recursive: true });

export async function uploadPortrait(characterId, fileStream, filename) {
  const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".avif", ".webp"];
  const extension = path.extname(filename).toLowerCase();

  if (!validExtensions.includes(extension)) {
    throw new Error("Invalid file type. Only images are allowed.");
  }

  const safeName = `portrait_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${extension}`;
  const characterUploadDir = path.join(UPLOAD_DIR, "portraits", characterId);

  await fsp.mkdir(characterUploadDir, { recursive: true });

  const filePath = path.join(characterUploadDir, safeName);

  const writeStream = fs.createWriteStream(filePath);

  await pipeline(fileStream, writeStream);

  // if (fileBuffer.length > 20 * 1024 * 1024) {
  //   throw new Error("File too large. Maximum size is 20MB.");
  // }

  // await fs.writeFile(filePath, fileBuffer);

  return `/uploads/portraits/${characterId}/${safeName}`;
}

export async function deletePortrait(characterId) {
  const characterUploadDir = path.join(UPLOAD_DIR, "portraits", characterId);

  try {
    await fsp.rm(characterUploadDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Could not delete portrait for character ${characterId}:`,
      error.message,
      `\nDoes the file exist?`,
    );
  }
}
