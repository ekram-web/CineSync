// Socket Client & Resilient Peer Sync Engine for CineSync
import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "localhost";
    return `http://${hostname}:5000`;
  }
  return "http://localhost:5000";
};

let socketInstance = null;
let broadcastChannel = null;

// Initialize BroadcastChannel for cross-tab synchronization fallback
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel("cinesync_sync_bus");
  } catch (e) {
    console.warn("BroadcastChannel not available:", e);
  }
}

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 8000,
      transports: ["websocket", "polling"],
    });
  }
  return socketInstance;
}

export function getBroadcastChannel() {
  return broadcastChannel;
}
