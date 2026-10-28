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

app.get("/", (req, res) => {
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

io.on("connection", (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // User Joins a Watch Room
  socket.on("join_room", ({ roomId, userName, movie, trailerUrl }) => {
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
        isPlaying: false,
        currentTime: 0,
        lastSyncTime: Date.now(),
        users: [],
      };
      rooms.set(roomId, room);
    }

    // Check if user already exists
    const existingIndex = room.users.findIndex((u) => u.id === socket.id);
    const isHost = socket.id === room.hostId;

    if (existingIndex === -1) {
      room.users.push({
        id: socket.id,
        name: socket.data.userName,
        isHost,
      });
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

    // Broadcast user joined to everyone in the room
    io.to(roomId).emit("user_joined", {
      user: socket.data.userName,
      users: room.users,
      message: `${socket.data.userName} joined the watch party!`,
    });

    console.log(`[User Joined] ${socket.data.userName} joined room: ${roomId}`);
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
