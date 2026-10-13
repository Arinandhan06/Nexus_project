import api from "./api";

/**
 * Derives the WebSocket base URL matching the current API configuration.
 */
export function getWsBaseUrl() {
  const httpUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
  try {
    const parsed = new URL(httpUrl, typeof window !== "undefined" ? window.location.href : "http://localhost:8000");
    const wsProto = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${parsed.host}`;
  } catch {
    if (typeof window !== "undefined") {
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${window.location.host}`;
    }
    return "ws://localhost:8000";
  }
}

/**
 * Requests a single-use 30-second ticket for the WebSocket endpoint.
 */
export async function fetchChamberWsTicket() {
  const res = await api.post("/ws/ticket");
  return res.data.ticket;
}

/**
 * Creates and manages a WebSocket connection to /ws/chamber with automatic
 * single-use ticket acquisition, reconnect backoff, and JSON event handling.
 */
export class ChamberWebSocketClient {
  constructor({ onMessage, onStatusChange, onError } = {}) {
    this.onMessage = onMessage || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.onError = onError || (() => {});

    this.ws = null;
    this.status = "disconnected"; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    this.isClosedByUser = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000; // Start at 1s, backoff up to 10s
    this.maxReconnectDelay = 10000;
  }

  setStatus(status) {
    this.status = status;
    this.onStatusChange(status);
  }

  async connect() {
    this.isClosedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.status === "reconnecting" ? "reconnecting" : "connecting");

    try {
      // 1. Fetch single-use ticket
      const ticket = await fetchChamberWsTicket();
      if (this.isClosedByUser) return;

      // 2. Open WebSocket
      const wsBase = getWsBaseUrl();
      const wsUrl = `${wsBase}/ws/chamber?ticket=${encodeURIComponent(ticket)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isClosedByUser) {
          this.ws?.close();
          return;
        }
        this.reconnectDelay = 1000;
        this.setStatus("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch {
          console.warn("[WS] Non-JSON payload received:", event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[WS] Socket error:", err);
        this.onError(err);
      };

      this.ws.onclose = () => {
        if (this.isClosedByUser) {
          this.setStatus("disconnected");
          return;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn("[WS] Ticket acquisition or handshake failed:", err?.message);
      this.onError(err);
      if (!this.isClosedByUser) {
        this.scheduleReconnect();
      } else {
        this.setStatus("disconnected");
      }
    }
  }

  scheduleReconnect() {
    this.setStatus("reconnecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      this.ws.send(payload);
      return true;
    }
    return false;
  }

  disconnect() {
    this.isClosedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }
}
