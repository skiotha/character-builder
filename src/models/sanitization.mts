import type { CharacterRole } from "#types";

export function sanitizeCharacterForRole(
  characterData: Record<string, unknown>,
  role: CharacterRole,
): Record<string, unknown> {
  const out = { ...characterData };
  if (role !== "dm" && role !== "owner") {
    delete out.backupCode;
    delete out.playerId;
    delete out.deleted;
    delete out.deletedAt;
    delete out.deletedBy;
  }

  return out;
}
