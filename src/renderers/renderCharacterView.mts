import { renderCharacter } from "../templates/character.mts";
import type { CharacterPermissions } from "#types";

export function renderCharacterView(
  character: Record<string, unknown>,
  permissions: CharacterPermissions,
): string {
  const formHTML = renderCharacter(character, permissions);

  return formHTML;
}
