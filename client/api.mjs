import * as nagara from "./state.mjs";

const { protocol, hostname, port } = window.location;
const base = `${protocol}//${hostname}${port ? ":" + port : ""}`;
const API_BASE = `${base}/api/v1`;

// const API_BASE = "http://127.0.0.1:3000/api/v1";
// const API_BASE = "https://nagara.team/api/v1";

export async function getCharacters() {
  const headers = {};

  const playerToken = nagara.getPlayerToken();
  if (playerToken) {
    headers["x-player-id"] = playerToken;
  }

  const dmToken = nagara.getDMToken();
  if (dmToken) {
    headers["x-dm-id"] = dmToken;
  }

  try {
    const response = await fetch(
      `${API_BASE}/characters?playerId=${encodeURIComponent(playerToken)}`,
      {
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching characters: ", error);
    throw error;
  }
}

export async function fetchView(view, characterId = undefined) {
  const headers = {};

  const playerToken = nagara.getPlayerToken();
  if (playerToken) {
    headers["x-player-id"] = playerToken;
  }

  const dmToken = nagara.getDMToken();
  if (dmToken) {
    headers["x-dm-id"] = dmToken;
  }

  try {
    const response = await fetch(
      `${API_BASE}/view/${view}${characterId ? `/${characterId}` : ""}`,
      {
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch the view: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error("Error fetching the view: ", error);
    throw error;
  }
}

export async function getCharacter(characterId) {
  try {
    const headers = {};

    const playerToken = nagara.getPlayerToken();
    if (playerToken) {
      headers["x-player-id"] = playerToken;
    }

    const dmToken = nagara.getDMToken();
    if (dmToken) {
      headers["x-dm-id"] = dmToken;
    }

    const response = await fetch(`${API_BASE}/characters/${characterId}`, {
      headers,
    });

    if (!response.ok) {
      const error = new Error(`Failed to fetch character: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching character: ", error);
    throw error;
  }
}

export async function createCharacter(characterData) {
  const playerToken = nagara.getPlayerToken();
  if (playerToken) {
    headers["x-player-id"] = playerToken;
  }

  const dmToken = nagara.getDMToken();
  if (dmToken) {
    headers["x-dm-id"] = dmToken;
  }

  try {
    const response = await fetch(`${API_BASE}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(characterData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create character: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating character: ", error);
    throw error;
  }
}

export async function recoverCharacter(characterName, backupCode) {
  try {
    const response = await fetch(`${API_BASE}/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ characterName, backupCode }),
    });

    if (!response.ok) {
      throw new Error(`Failed to recover character: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error recovering characters: ", error);
    throw error;
  }
}

export async function validateToken(playerId) {
  try {
    const response = await fetch(
      `${API_BASE}/characters?playerId=${encodeURIComponent(playerId)}`,
      {
        headers: {
          "x-player-id": playerId,
        },
      },
    );
    return response.ok;
  } catch (error) {
    console.log("Error validating token:", error);
    return false;
  }
}

export async function getAbilities() {
  try {
    const response = await fetch(`${API_BASE}/abilities`);

    return await response.json();
  } catch (error) {
    console.log("Error getting abilities from the server:", error);
    return false;
  }
}

export async function validateDM(dmToken) {
  try {
    const response = await fetch(`${API_BASE}/dm/validate`, {
      headers: { "x-dm-id": dmToken },
    });
    return response.ok;
  } catch {
    return false;
  }
}
