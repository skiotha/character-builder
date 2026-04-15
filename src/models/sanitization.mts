import type { CharacterRole } from "#types";

export function sanitizeCharacterForRole(
  characterData: Record<string, unknown>,
  role: CharacterRole,
): Record<string, unknown> {
  if (role !== "dm" && role !== "owner") {
    delete characterData.backupCode;
    delete characterData.playerId;
    delete characterData.deleted;
    delete characterData.deletedAt;
    delete characterData.deletedBy;
  }

  return characterData;
}
