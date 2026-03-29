export function createCharacterCard(character, onClick) {
  const parser = new DOMParser();

  const template = `
    <article class="character-card" data-character-id="${character.id}">
      <header>
        <h3>${escapeHtml(character.characterName)}</h3>
        <span class="badge">Level ${character.experience.total}</span>
      </header>
      <div class="details">
        <p><strong>Race:</strong> ${character.background.race}</p>
        <p><strong>Class:</strong> ${character.class || "Not set"}</p>
      </div>
      <footer>
        <button data-action="view" class="btn-text">View →</button>
      </footer>
    </article>
    `;

  const doc = parser.parseFromString(template, "text/html");
  const card = doc.body.firstElementChild;

  card.addEventListener("click", onClick);

  return card;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
