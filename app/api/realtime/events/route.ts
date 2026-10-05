import { NextRequest } from "next/server";
import { realtimeBroadcaster } from "@/server/realtime/broadcaster";
import type { RealtimeEvent } from "@/server/realtime/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: Date.now() })}\n\n`)
      );

      const onRealtimeEvent = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream is closed
        }
      };

      realtimeBroadcaster.emitter.on("realtime", onRealtimeEvent);

      // Heartbeat every 25 seconds to keep connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        realtimeBroadcaster.emitter.off("realtime", onRealtimeEvent);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
