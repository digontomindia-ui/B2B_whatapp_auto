import { NEXT_RUNTIME } from "./lib/env";

export async function register() {
  if (NEXT_RUNTIME === "nodejs") {
    const { startWebSocketServer } =
      await import("./server/realtime/ws-server");
    startWebSocketServer();
  }
}
