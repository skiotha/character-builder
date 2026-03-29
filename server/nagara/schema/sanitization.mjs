export function sanitizeCharacterForRole(characterData, role) {
  if (role !== "dm" && role !== "owner") {
    delete characterData.backupCode;
    delete characterData.playerId;
  }

  return characterData;
}
