import api from "./api";

/**
 * Derives the WebSocket base URL matching the current API configuration.
 */
export function getWsBaseUrl() {
  const PRODUCTION_BACKEND_URL = "https://nexus-backend-vdbp.onrender.com";
  const defaultHost = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
  const isDevPort = typeof window !== "undefined" && (window.location.port === "5173" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const fallbackUrl = isDevPort ? `http://${defaultHost}:8000` : PRODUCTION_BACKEND_URL;
  let rawUrl = import.meta.env.VITE_API_URL || fallbackUrl;
  if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    rawUrl = `https://${rawUrl}`;
  }
  const httpUrl = rawUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(httpUrl, typeof window !== "undefined" ? window.location.href : `http://${defaultHost}:8000`);
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
  const token = sessionStorage.getItem("authToken");
  if (!token || token === "undefined") {
    throw new Error("No active session token for WebSocket connection.");
  }
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

    const token = sessionStorage.getItem("authToken");
    if (!token || token === "undefined") {
      this.setStatus("disconnected");
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
      this.onError(err);
      if (err.response?.status === 401 || err.message?.includes("No active session")) {
        this.setStatus("disconnected");
        return;
      }
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
