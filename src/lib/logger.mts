export function logServerEvent(message: string, origin?: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${origin || "server"}] ${message}`);
}
