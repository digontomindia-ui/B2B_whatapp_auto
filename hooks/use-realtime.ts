"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent } from "@/server/realtime/events";
import { WS_PORT_CLIENT } from "@/lib/constant";

export function useRealtime(activeConversationId?: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let sse: EventSource | null = null;
    let isConnectedWs = false;

    function handleEvent(event: RealtimeEvent) {
      const { type, data } = event;

      // Invalidate relevant queries in React Query cache
      if (
        type === "CUSTOMER_CREATED" ||
        type === "CUSTOMER_UPDATED" ||
        type === "CUSTOMER_UNREAD_UPDATED"
      ) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }

      if (
        type === "MESSAGE_CREATED" ||
        type === "MESSAGE_UPDATED" ||
        type === "MESSAGE_SENT" ||
        type === "MESSAGE_DELIVERED" ||
        type === "MESSAGE_READ" ||
        type === "MESSAGE_FAILED"
      ) {
        queryClient.invalidateQueries({ queryKey: ["customers"] });

        // If message belongs to active conversation, invalidate messages query
        const msg = data as { conversationId?: string };
        if (msg.conversationId) {
          queryClient.invalidateQueries({
            queryKey: ["messages", msg.conversationId]
          });
        } else if (activeConversationId) {
          queryClient.invalidateQueries({
            queryKey: ["messages", activeConversationId]
          });
        }
      }

      if (
        type === "BULK_JOB_CREATED" ||
        type === "BULK_JOB_UPDATED" ||
        type === "BULK_RECIPIENT_UPDATED"
      ) {
        queryClient.invalidateQueries({ queryKey: ["bulk-jobs"] });
      }
    }

    function connectWebSocket() {
      if (typeof window === "undefined") return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.hostname || "localhost";
      const wsPort = WS_PORT_CLIENT;
      const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          isConnectedWs = true;
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        };

        ws.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (
              parsed.type &&
              parsed.type !== "CONNECTED" &&
              parsed.type !== "PONG"
            ) {
              handleEvent(parsed);
            }
          } catch {
            // ignore non-json
          }
        };

        ws.onclose = () => {
          isConnectedWs = false;
          // Try reconnect after 3 seconds, or switch to SSE
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          if (!sse) startSseFallback();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        startSseFallback();
      }
    }

    function startSseFallback() {
      if (sse || isConnectedWs) return;
      try {
        sse = new EventSource("/api/realtime/events");
        sse.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.type && parsed.type !== "CONNECTED") {
              handleEvent(parsed);
            }
          } catch {
            // ignore
          }
        };
      } catch {
        // SSE error
      }
    }

    connectWebSocket();

    // Ping interval for WebSocket
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "PING" }));
      }
    }, 20000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
      if (sse) sse.close();
    };
  }, [queryClient, activeConversationId]);
}
