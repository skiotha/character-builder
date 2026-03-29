import { renderCharacter } from "../templates/character.mjs";

export function renderCharacterView(character, permissions) {
  const formHTML = renderCharacter(character, permissions);

  return formHTML;
}
