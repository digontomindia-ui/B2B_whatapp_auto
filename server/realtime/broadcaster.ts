import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import type { RealtimeEvent, RealtimeEventType } from "./events";

class RealtimeBroadcaster {
  private static instance: RealtimeBroadcaster;
  public readonly emitter = new EventEmitter();
  private wsClients = new Set<WebSocket>();

  private constructor() {
    this.emitter.setMaxListeners(200);
  }

  static getInstance(): RealtimeBroadcaster {
    if (!RealtimeBroadcaster.instance) {
      RealtimeBroadcaster.instance = new RealtimeBroadcaster();
    }
    return RealtimeBroadcaster.instance;
  }

  registerWsClient(ws: WebSocket): void {
    this.wsClients.add(ws);
    ws.on("close", () => {
      this.wsClients.delete(ws);
    });
    ws.on("error", () => {
      this.wsClients.delete(ws);
    });
  }

  broadcast<T = unknown>(type: RealtimeEventType, data: T): void {
    const event: RealtimeEvent<T> = {
      type,
      data,
      timestamp: Date.now()
    };

    // Emit for internal listeners (such as SSE streams or local jobs)
    this.emitter.emit("realtime", event);
    this.emitter.emit(type, data);

    // Send to connected WebSocket clients
    const payload = JSON.stringify(event);
    for (const ws of this.wsClients) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error("Failed to send WS message:", err);
          this.wsClients.delete(ws);
        }
      }
    }
  }

  getClientCount(): number {
    return this.wsClients.size;
  }
}

export const realtimeBroadcaster = RealtimeBroadcaster.getInstance();
