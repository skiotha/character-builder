export function logServerEvent(message, origin) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${origin || "server"}] ${message}`);
}
