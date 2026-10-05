import { realtimeBroadcaster } from "./broadcaster";
import { WebSocketServer } from "ws";
import { WS_PORT } from "@/lib/env";

const globalWs = globalThis as unknown as { __wss_initialized?: boolean };

export function startWebSocketServer(): void {
  if (globalWs.__wss_initialized) {
    return;
  }

  try {
    const port = WS_PORT || 3002;
    const wss = new WebSocketServer({ port });

    wss.on("connection", (ws) => {
      realtimeBroadcaster.registerWsClient(ws);

      // Send initial welcome message
      ws.send(
        JSON.stringify({
          type: "CONNECTED",
          data: { timestamp: Date.now() }
        })
      );

      // Handle ping/pong heartbeat
      ws.on("message", (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
          }
        } catch {
          // ignore non-json messages
        }
      });
    });

    wss.on("error", (err: unknown) => {
      // EADDRINUSE can happen in hot reload, which is safe to ignore
      const code = (err as { code?: string })?.code;
      if (code !== "EADDRINUSE") {
        console.error("WebSocket Server error:", err);
      }
    });

    globalWs.__wss_initialized = true;
    console.log(
      `[Realtime] WebSocket server listening on ws://localhost:${port}`
    );
  } catch (err) {
    console.warn(
      "[Realtime] Could not initialize standalone WebSocket port:",
      err
    );
  }
}
