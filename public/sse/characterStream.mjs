import * as nagara from "state";

const SSE_BASE = "/api/v1/characters";

let eventSource = null;
let currentCharacterId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

let lastEventTime = Date.now();

export function connectCharacterStream(characterId) {
  if (eventSource && currentCharacterId === characterId) {
    console.log("SSE already connected for this character");
    return;
  }

  if (!characterId) {
    console.error("SSE Cannot connect -- no character ID");
    return;
  }

  disconnectCharacterStream();

  currentCharacterId = characterId;
  reconnectAttempts = 0;

  const url = new URL(
    `${SSE_BASE}/${characterId}/stream`,
    window.location.origin,
  );

  const playerToken = nagara.getPlayerToken();
  if (playerToken) url.searchParams.set("playerId", playerToken);

  const dmToken = nagara.getDMToken();
  if (dmToken) url.searchParams.set("dmId", dmToken);

  console.log("Connecting SSE stream:", url.toString());
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log("SSE connection opened");
    reconnectAttempts = 0;
  };

  eventSource.onerror = (error) => {
    console.error("SSE error", error);

    if (eventSource.readyState === EventSource.CLOSED) {
      reconnectAttempts++;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn("Max reconnect attempts reached, closing SSE");
        disconnectCharacterStream();

        // showToast('Real-time updates unavailable','warning')
      }
    }
  };

  eventSource.addEventListener("connected", (e) => {
    const data = JSON.parse(e.data);
    console.log("SSE connected message:", data.message);
  });

  eventSource.addEventListener("character-updated", (e) => {
    lastEventTime = Date.now();
    const data = JSON.parse(e.data);
    console.log("Character updated via SSE:", data.timeStamp);

    if (data.character) {
      nagara.setCurrentCharacter(data.character);
    }
  });

  //   eventSource.addEventListener("ping", () => {
  //     console.log("ping");
  //     lastEventTime = Date.now();
  //   });

  eventSource.onmessage = (e) => {
    lastEventTime = Date.now();
  };
}

export function disconnectCharacterStream() {
  if (eventSource) {
    console.log("Closing SSE connection");
    eventSource.close();
    eventSource = null;
    // currentCharacterId = null;
    reconnectAttempts = 0;
    // clearInterval(heartbeat);
  }
}

// const heartbeat = setInterval(() => {
//   if (Date.now() - lastEventTime > 60000) {
//     console.warn("No SSE events for 60s, reconnecting...");
//     disconnectCharacterStream();
//     connectCharacterStream(currentCharacterId);
//   }
// }, 45000);
