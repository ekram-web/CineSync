// Socket Client & Resilient Peer Sync Engine for CineSync
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

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
    socketInstance = io(SERVER_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      timeout: 5000,
    });
  }
  return socketInstance;
}

export function getBroadcastChannel() {
  return broadcastChannel;
}
