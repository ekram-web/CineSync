import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// In-Memory Room State
// roomId -> { movieId, movieTitle, trailerUrl, hostId, isPlaying, currentTime, lastSyncTime, users: [] }
const rooms = new Map();

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    message: "CineSync Real-Time WebSocket Server Running",
    activeRooms: rooms.size,
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json(room);
});

// Full-Stack Static Serving: Serve frontend if dist/ exists (Render/Railway unified deployment)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/health")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      status: "online",
      message: "CineSync Real-Time WebSocket Server Running",
      activeRooms: rooms.size,
    });
  });
}

io.on("connection", (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // User Joins a Watch Room
  socket.on("join_room", ({ roomId, userName, movie, trailerUrl, hostToken }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userName = userName || "Guest";

    let room = rooms.get(roomId);

    if (!room) {
      // First user to join becomes the Host
      room = {
        roomId,
        movieId: movie?.id || null,
        movieTitle: movie?.title || movie?.name || "Movie Watch Party",
        trailerUrl: trailerUrl || "",
        movieData: movie || null,
        hostId: socket.id,
        hostName: socket.data.userName,
        hostToken: hostToken || null,
        isPlaying: false,
        currentTime: 0,
        lastSyncTime: Date.now(),
        users: [],
      };
      rooms.set(roomId, room);
    } else {
      // Existing room:
      // If client provides matching hostToken or claims host when hostId is not connected
      if (hostToken && room.hostToken === hostToken) {
        room.hostId = socket.id;
        room.hostName = socket.data.userName;
      }
      // Populate movie data from creator if guest arrived before movie details resolved
      if (!room.movieData && movie) {
        room.movieData = movie;
        room.movieTitle = movie?.title || movie?.name || room.movieTitle;
      }
      if (!room.trailerUrl && trailerUrl) {
        room.trailerUrl = trailerUrl;
      }
    }

    // Check if user already exists
    const existingIndex = room.users.findIndex((u) => u.id === socket.id);
    const isHost = socket.id === room.hostId || (hostToken && room.hostToken === hostToken);

    if (existingIndex === -1) {
      room.users.push({
        id: socket.id,
        name: socket.data.userName,
        isHost,
      });
    } else {
      room.users[existingIndex].name = socket.data.userName;
      room.users[existingIndex].isHost = isHost;
    }

    // Calculate current timestamp compensation if already playing
    let currentPos = room.currentTime;
    if (room.isPlaying) {
      const elapsed = (Date.now() - room.lastSyncTime) / 1000;
      currentPos += elapsed;
    }

    // Send complete room state to the newly joined user
    socket.emit("room_state", {
      roomId: room.roomId,
      movie: room.movieData,
      movieTitle: room.movieTitle,
      trailerUrl: room.trailerUrl,
      isHost,
      hostName: room.hostName,
      isPlaying: room.isPlaying,
      currentTime: currentPos,
      users: room.users,
    });

    // Broadcast user list to everyone in the room
    io.to(roomId).emit("user_joined", {
      user: socket.data.userName,
      users: room.users,
      isHost,
      message: `${socket.data.userName} joined the watch party!`,
    });

    console.log(`[User Joined] ${socket.data.userName} joined room: ${roomId} (Host: ${isHost})`);
  });

  // Change Video / Trailer (Host action)
  socket.on("change_video", ({ roomId, trailerId, movieTitle }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.trailerUrl = trailerId;
    if (movieTitle) room.movieTitle = movieTitle;
    room.currentTime = 0;
    room.isPlaying = true;
    room.lastSyncTime = Date.now();

    io.to(roomId).emit("video_changed", {
      trailerId,
      movieTitle: room.movieTitle,
      message: `Host changed the video to "${room.movieTitle || 'New Stream'}"`,
    });
    console.log(`[Video Changed] Room: ${roomId} -> Video: ${trailerId}`);
  });

  // Playback Sync: Play, Pause, Seek
  socket.on("sync_playback", ({ roomId, action, timestamp }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.isPlaying = action === "play";
    room.currentTime = timestamp;
    room.lastSyncTime = Date.now();

    // Broadcast playback event with server timestamp for latency compensation
    socket.to(roomId).emit("sync_playback", {
      action,
      timestamp,
      hostTime: Date.now(),
    });

    console.log(`[Playback Sync] Room: ${roomId} -> ${action.toUpperCase()} at ${timestamp.toFixed(1)}s`);
  });

  // Live Chat Message
  socket.on("chat_message", ({ roomId, user, message }) => {
    if (!message || !message.trim()) return;

    const chatPayload = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user: user || socket.data.userName || "Guest",
      message: message.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    io.to(roomId).emit("receive_message", chatPayload);
  });

  // Typing Indicator
  socket.on("typing", ({ roomId, user, isTyping }) => {
    socket.to(roomId).emit("user_typing", {
      user: user || socket.data.userName,
      isTyping,
    });
  });

  // Floating Emoji Reaction
  socket.on("reaction", ({ roomId, emoji, user }) => {
    if (!emoji) return;

    const reactionPayload = {
      id: `${Date.now()}_${Math.random()}`,
      emoji,
      user: user || socket.data.userName,
    };

    io.to(roomId).emit("receive_reaction", reactionPayload);
  });

  // Handle Disconnect & Host Reassignment
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Remove user
    room.users = room.users.filter((u) => u.id !== socket.id);

    // If host left, promote the next user to host
    if (socket.id === room.hostId && room.users.length > 0) {
      room.hostId = room.users[0].id;
      room.hostName = room.users[0].name;
      room.users[0].isHost = true;

      io.to(room.hostId).emit("promoted_to_host");
      console.log(`[Host Reassigned] ${room.hostName} is now host of ${roomId}`);
    }

    if (room.users.length === 0) {
      // Room empty, delete after a grace period
      setTimeout(() => {
        const checkRoom = rooms.get(roomId);
        if (checkRoom && checkRoom.users.length === 0) {
          rooms.delete(roomId);
          console.log(`[Room Cleaned] Deleted empty room: ${roomId}`);
        }
      }, 60000);
    } else {
      io.to(roomId).emit("user_left", {
        user: socket.data.userName,
        users: room.users,
        message: `${socket.data.userName} left the room.`,
      });
    }

    console.log(`[Socket Disconnected] ${socket.data.userName} (${socket.id})`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CineSync WebSocket Server running on port ${PORT}`);
});
