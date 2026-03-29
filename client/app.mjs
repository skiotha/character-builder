import * as nagara from "@state";
import { navigate, init as initRouter } from "@router";
import * as api from "@api";
import { setCharacters, setCurrentCharacter } from "./state.mjs";

const TEMPLATE_CACHE_KEY = "nagara_templates_v1";

async function init() {
  // localStorage.setItem("x-player-id", "AhaniPlayer");
  // localStorage.removeItem("x-player-id");

  const root = document.getElementById("app");
  initRouter(root);

  const playerToken = nagara.getPlayerToken();
  const dmToken = nagara.getDMToken();

  if (playerToken) await nagara.setPlayerToken(playerToken);
  if (dmToken) await nagara.setDMToken(dmToken);

  const hash = window.location.hash.slice(1);
  const hasHash = hash.length > 0;

  if (!hasHash) {
    await showStartPage();
  } else {
    await handleHashRoute(hash);
  }

  // if (hasHash) {
  //   const [base, characterId] = hash.split("/");

  //   if (base === "character" && characterId) {
  //     await validateAndNavigateToCharacter(characterId, playerToken);
  //   } else {
  //     await navigateToStartPage(playerToken);
  //   }
  // } else {
  //   await navigateToStartPage(playerToken);
  // }
}

async function showStartPage() {
  const state = nagara.getState();

  if (state.playerToken) {
    try {
      const characters = await api.getCharacters(state.playerToken);
      nagara.setCharacters(characters);
      navigate("dashboard");
    } catch (error) {
      nagara.setPlayerToken(null);
      navigate("");
    }
  } else {
    navigate("");
  }
}

async function handleHashRoute(hash) {
  console.log(hash);
  const parts = hash.split("/");
  const route = parts[0];
  const param = parts[1];

  if (route === "character" && param) {
    await loadCharacterView(param);
  } else {
    await showStartPage();
  }
}

async function loadCharacterView(characterId) {
  try {
    const character = await api.getCharacter(characterId);

    if (character.playerId && character.playerId === nagara.getPlayerToken()) {
      nagara.setCurrentCharacter(character);
    }

    navigate(`character/${characterId}`);
  } catch (error) {
    console.error("Failed to load character:", error);
    showError("Character not found or inaccessible");
    navigate("");
  }
}

// async function validateAndNavigateToCharacter(characterId, token) {
//   try {
//     const character = await api.getCharacter(characterId, token);

//     if (!character) {
//       showError("Character not found");
//       navigate("");
//       return;
//     }

//     const state = getState();
//     const isOwner =
//       state.playerToken && character.playerId === state.playerToken;
//     const dmID = getDMToken();
//     const isDM = dmID && (await api.validateDM(dmID));

//     setState({
//       currentCharacter: character,
//       userRole: isDM ? "dm" : isOwner ? "owner" : "viewer",
//     });

//     navigate(`/character/${characterId}`, {
//       character,
//       permissions: getState().userRole,
//     });
//   } catch (error) {
//     console.error("Failed to load character:", error);

//     if (error.status === 404) {
//       showError("Character not found");
//       navigate("");
//     } else if (error.status === 403) {
//       showError("You don't have permission to view this character");
//       navigate(token ? "dashboard" : "");
//     } else {
//       showError("Failed to load character. Please try again");
//     }
//   }
// }

// async function navigateToStartPage(token) {
//   if (isDM()) {
//     try {
//       const dmToken = getDMToken();
//       if (dmToken && (await api.validateDM(dmToken))) {
//         navigate("dashboard");
//         return;
//       }
//     } catch (error) {
//       console.error("DM validation failed:", error);
//       localStorage.removeItem("x-dm-id");
//       navigate("");
//     }
//   }

//   if (token) {
//     try {
//       const isValid = await api.validateToken(token);

//       if (isValid) {
//         const characters = await api.getCharacters(token);
//         setCharacters(characters);

//         navigate("dashboard");
//       } else {
//         localStorage.removeItem("x-player-id");
//         setPlayerToken(null);

//         navigate("");
//       }
//     } catch (error) {
//       console.error("Token validation failed:", error);
//       localStorage.removeItem("x-player-id");
//       setPlayerToken(null);

//       navigate("");
//     }
//   } else {
//     navigate("");
//   }
// }

function showError(message) {
  console.error(message);
}

document.addEventListener("DOMContentLoaded", init, { once: true });
