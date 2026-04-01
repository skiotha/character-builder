import { renderCharacter } from "../templates/character.mts";

export function renderCharacterView(character, permissions) {
  const formHTML = renderCharacter(character, permissions);

  return formHTML;
}
