import { Alert } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

type MessageHandler = (alert: Alert) => void;
type HistoryHandler = (alerts: Alert[]) => void;

let socket: WebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export function connectWebSocket(
  onAlert: MessageHandler,
  onHistory: HistoryHandler,
  onStatusChange?: (connected: boolean) => void
) {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    onStatusChange?.(true);
    // Keep-alive ping every 30 seconds
    pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send("ping");
      }
    }, 30_000);
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "alert") {
        onAlert(payload.data as Alert);
      } else if (payload.type === "history") {
        onHistory(payload.data as Alert[]);
      }
    } catch {
      // ignore non-JSON (e.g. "pong")
    }
  };

  socket.onclose = () => {
    onStatusChange?.(false);
    if (pingInterval) clearInterval(pingInterval);
    // Reconnect after 5 seconds
    setTimeout(() => connectWebSocket(onAlert, onHistory, onStatusChange), 5_000);
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function disconnectWebSocket() {
  if (pingInterval) clearInterval(pingInterval);
  socket?.close();
  socket = null;
}
