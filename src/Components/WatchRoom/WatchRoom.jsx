import React, { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";
import movieTrailer from "movie-trailer";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SyncIcon from "@mui/icons-material/Sync";
import { getSocket, getBroadcastChannel } from "../../utils/socketClient";
import ChatSidebar from "./ChatSidebar";
import FloatingReactions from "./FloatingReactions";
import "./watchRoom.css";

// Reliable backup trailer IDs if TMDB trailer lookup is unavailable
const BACKUP_TRAILERS = [
  "dQw4w9WgXcQ",
  "d9MyW72ELq0", // Avatar
  "zSWdZVtXT7E", // Interstellar
  "8Qn_spdM5Zg", // Inception
];

const WatchRoom = ({
  roomId,
  initialMovie,
  initialTrailerUrl,
  initialIsHost = false,
  onLeaveRoom,
}) => {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem("cinesync_username") || "";
  });
  const [tempNameInput, setTempNameInput] = useState("");
  const [isNameModalOpen, setIsNameModalOpen] = useState(!userName);

  const [movie, setMovie] = useState(() => {
    if (initialMovie) return initialMovie;
    try {
      const raw = localStorage.getItem(`cinesync_room_${roomId}`);
      if (raw) return JSON.parse(raw).movie || null;
    } catch (e) {}
    return null;
  });

  const [trailerId, setTrailerId] = useState(() => {
    if (initialTrailerUrl) return initialTrailerUrl;
    try {
      const raw = localStorage.getItem(`cinesync_room_${roomId}`);
      if (raw) return JSON.parse(raw).trailerUrl || "";
    } catch (e) {}
    return "";
  });

  const [isHost, setIsHost] = useState(Boolean(initialIsHost));
  const [hostName, setHostName] = useState(() => (initialIsHost ? userName || "You" : ""));
  const [users, setUsers] = useState(() => {
    if (userName) {
      return [{ id: initialIsHost ? "host" : `user_${Date.now()}`, name: userName, isHost: Boolean(initialIsHost) }];
    }
    return [];
  });

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [incomingReaction, setIncomingReaction] = useState(null);
  const [copied, setCopied] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");

  const playerRef = useRef(null);
  const isInternalAction = useRef(false);

  // Auto-fetch trailer if not provided
  useEffect(() => {
    if (!trailerId && movie) {
      const title = movie.title || movie.name || movie.original_name || "";
      movieTrailer(title)
        .then((url) => {
          if (url) {
            const urlParams = new URLSearchParams(new URL(url).search);
            const vId = urlParams.get("v");
            if (vId) setTrailerId(vId);
          } else {
            // Pick a reliable cinematic clip as fallback
            setTrailerId(BACKUP_TRAILERS[2]);
          }
        })
        .catch(() => {
          setTrailerId(BACKUP_TRAILERS[2]);
        });
    } else if (!trailerId && !movie) {
      // If joined with just a room ID and no movie yet, use a fallback
      setTrailerId(BACKUP_TRAILERS[2]);
    }
  }, [movie, trailerId]);

  // Main Real-Time Engine (Socket.IO + BroadcastChannel Fallback)
  useEffect(() => {
    if (!userName || !roomId) return;

    const socket = getSocket();
    const bc = getBroadcastChannel();

    // 1. Try Socket.IO connection
    try {
      socket.connect();
      socket.emit("join_room", {
        roomId,
        userName,
        movie,
        trailerUrl: trailerId,
      });
    } catch (e) {}

    // 2. Announce presence on BroadcastChannel for seamless local multi-tab sync
    if (bc) {
      bc.postMessage({
        type: "user_joined",
        roomId,
        user: userName,
        isHost,
        movie,
        trailerId,
      });

      // If Guest, request the current room state from the Host tab
      if (!isHost) {
        bc.postMessage({
          type: "request_room_state",
          roomId,
          guestName: userName,
        });
      }
    }

    // --- Socket Event Handlers ---
    const handleRoomState = (state) => {
      setIsHost(state.isHost);
      setHostName(state.hostName || "");
      if (state.movie) setMovie(state.movie);
      if (state.trailerUrl && !trailerId) setTrailerId(state.trailerUrl);
      if (state.users) setUsers(state.users);

      if (state.currentTime > 0 && playerRef.current) {
        playerRef.current.seekTo(state.currentTime, true);
        if (state.isPlaying) {
          playerRef.current.playVideo();
        }
      }
    };

    const handleUserJoined = (data) => {
      if (data.users) {
        setUsers(data.users);
      } else {
        setUsers((prev) => {
          const exists = prev.some((u) => u.name === data.user);
          if (exists) return prev;
          return [...prev, { id: `u_${Date.now()}`, name: data.user, isHost: Boolean(data.isHost) }];
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          isSystem: true,
          text: data.message || `${data.user} joined the room!`,
        },
      ]);
    };

    const handleUserLeft = (data) => {
      if (data.users) setUsers(data.users);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          isSystem: true,
          text: data.message || `${data.user} left the room.`,
        },
      ]);
    };

    const handleSyncPlayback = ({ action, timestamp, hostTime }) => {
      if (!playerRef.current) return;

      isInternalAction.current = true;
      const latencyComp = hostTime ? (Date.now() - hostTime) / 1000 : 0;
      const targetTime = Math.max(0, timestamp + latencyComp);

      setSyncNotice(`Host ${action}ed at ${targetTime.toFixed(1)}s`);
      setTimeout(() => setSyncNotice(""), 2200);

      playerRef.current.seekTo(targetTime, true);
      if (action === "play") {
        playerRef.current.playVideo();
      } else if (action === "pause") {
        playerRef.current.pauseVideo();
      }

      setTimeout(() => {
        isInternalAction.current = false;
      }, 400);
    };

    const handleReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleUserTyping = ({ user, isTyping }) => {
      setTypingUsers((prev) => {
        if (isTyping) {
          return prev.includes(user) ? prev : [...prev, user];
        } else {
          return prev.filter((u) => u !== user);
        }
      });
    };

    const handleReceiveReaction = (payload) => {
      setIncomingReaction(payload);
    };

    const handlePromotedToHost = () => {
      setIsHost(true);
      setSyncNotice("👑 You are now the Room Host!");
      setTimeout(() => setSyncNotice(""), 3000);
    };

    socket.on("room_state", handleRoomState);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("sync_playback", handleSyncPlayback);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("receive_reaction", handleReceiveReaction);
    socket.on("promoted_to_host", handlePromotedToHost);

    // --- BroadcastChannel Message Bus (Syncs across tabs when server is offline) ---
    const handleBroadcastMessage = (event) => {
      const data = event.data;
      if (!data || data.roomId !== roomId) return;

      if (data.type === "request_room_state" && isHost) {
        // Host replies with current state
        let currentTime = 0;
        let isPlaying = false;
        try {
          if (playerRef.current) {
            currentTime = playerRef.current.getCurrentTime() || 0;
            isPlaying = playerRef.current.getPlayerState() === 1;
          }
        } catch (e) {}

        const updatedUsers = users.some((u) => u.name === data.guestName)
          ? users
          : [...users, { id: `guest_${Date.now()}`, name: data.guestName, isHost: false }];

        setUsers(updatedUsers);

        bc.postMessage({
          type: "room_state",
          roomId,
          movie,
          trailerId,
          hostName: userName,
          users: updatedUsers,
          isPlaying,
          currentTime,
        });

        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}`, isSystem: true, text: `${data.guestName} joined the watch party!` },
        ]);
      } else if (data.type === "room_state") {
        if (data.movie) setMovie(data.movie);
        if (data.trailerId) setTrailerId(data.trailerId);
        if (data.hostName) setHostName(data.hostName);
        if (data.users) setUsers(data.users);

        if (data.currentTime > 0 && playerRef.current) {
          playerRef.current.seekTo(data.currentTime, true);
          if (data.isPlaying) playerRef.current.playVideo();
        }
      } else if (data.type === "user_joined" && data.user !== userName) {
        handleUserJoined(data);
      } else if (data.type === "sync_playback") {
        handleSyncPlayback(data);
      } else if (data.type === "chat_message") {
        handleReceiveMessage(data.payload);
      } else if (data.type === "reaction") {
        handleReceiveReaction(data.payload);
      } else if (data.type === "typing") {
        handleUserTyping(data);
      }
    };

    if (bc) {
      bc.addEventListener("message", handleBroadcastMessage);
    }

    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("sync_playback", handleSyncPlayback);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("receive_reaction", handleReceiveReaction);
      socket.off("promoted_to_host", handlePromotedToHost);

      if (bc) {
        bc.removeEventListener("message", handleBroadcastMessage);
      }

      socket.disconnect();
    };
  }, [userName, roomId, trailerId, isHost, movie, users]);

  // Host Action: Emit playback events to all peers
  const emitPlayback = (action) => {
    if (!playerRef.current || isInternalAction.current) return;

    try {
      const currentTime = playerRef.current.getCurrentTime() || 0;
      const payload = {
        roomId,
        action,
        timestamp: currentTime,
        hostTime: Date.now(),
      };

      const socket = getSocket();
      if (socket.connected) {
        socket.emit("sync_playback", payload);
      }

      const bc = getBroadcastChannel();
      if (bc) {
        bc.postMessage({ type: "sync_playback", ...payload });
      }
    } catch (e) {
      console.warn("Player time error:", e);
    }
  };

  const handlePlayerReady = (event) => {
    playerRef.current = event.target;
  };

  const handlePlayerStateChange = (event) => {
    if (isInternalAction.current) return;

    if (isHost) {
      if (event.data === 1) {
        emitPlayback("play");
      } else if (event.data === 2) {
        emitPlayback("pause");
      }
    }
  };

  const handleHostForcePlay = () => {
    if (playerRef.current) {
      playerRef.current.playVideo();
      emitPlayback("play");
    }
  };

  const handleHostForcePause = () => {
    if (playerRef.current) {
      playerRef.current.pauseVideo();
      emitPlayback("pause");
    }
  };

  const handleHostSyncAll = () => {
    if (playerRef.current) {
      const state = playerRef.current.getPlayerState();
      emitPlayback(state === 1 ? "play" : "pause");
      setSyncNotice("Sync signal broadcasted to all viewers");
      setTimeout(() => setSyncNotice(""), 2000);
    }
  };

  const handleSendMessage = (messageText) => {
    const payload = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user: userName,
      message: messageText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("chat_message", { roomId, user: userName, message: messageText });
    } else {
      setMessages((prev) => [...prev, payload]);
    }

    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage({ type: "chat_message", roomId, payload });
    }
  };

  const handleTyping = (isTyping) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("typing", { roomId, user: userName, isTyping });
    }
    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage({ type: "typing", roomId, user: userName, isTyping });
    }
  };

  const handleSendReaction = (emoji) => {
    const payload = {
      id: `${Date.now()}_${Math.random()}`,
      emoji,
      user: userName,
    };

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("reaction", { roomId, emoji, user: userName });
    } else {
      setIncomingReaction(payload);
    }

    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage({ type: "reaction", roomId, payload });
    }
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    if (!tempNameInput.trim()) return;
    const cleanName = tempNameInput.trim();
    localStorage.setItem("cinesync_username", cleanName);
    setUserName(cleanName);
    setIsNameModalOpen(false);

    setUsers((prev) => {
      const exists = prev.some((u) => u.name === cleanName);
      if (exists) return prev;
      return [...prev, { id: isHost ? "host" : `u_${Date.now()}`, name: cleanName, isHost }];
    });
  };

  const movieTitle = movie?.title || movie?.name || movie?.original_name || "Watch Party Stream";

  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
      controls: isHost ? 1 : 0,
    },
  };

  return (
    <div className="watchRoom__container">
      {/* Display Name Modal if joining without name */}
      {isNameModalOpen && (
        <div className="watchRoom__nameModalOverlay">
          <div className="watchRoom__nameModal">
            <h3>Join Watch Party</h3>
            <p>Enter your display name to start watching and chatting with friends:</p>
            <form onSubmit={handleSaveName}>
              <input
                type="text"
                className="watchRoom__nameInput"
                placeholder="Your name (e.g. Sarah)"
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="watchRoom__nameSubmitBtn"
                disabled={!tempNameInput.trim()}
              >
                Join Watch Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="watchRoom__header">
        <div className="watchRoom__headerLeft">
          <button className="watchRoom__backBtn" onClick={onLeaveRoom}>
            <ArrowBackIcon style={{ fontSize: "1.1rem" }} />
            <span>Leave Room</span>
          </button>

          <div className="watchRoom__titleBox">
            <h1 className="watchRoom__movieTitle">{movieTitle}</h1>
            <div className="watchRoom__badgeRow">
              <span className="watchRoom__roomBadge">Room: {roomId}</span>
              {isHost ? (
                <span className="watchRoom__hostBadge hostMe">👑 You are Host</span>
              ) : (
                <span className="watchRoom__hostBadge">
                  Host: {hostName || "Host"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="watchRoom__headerRight">
          <button className="watchRoom__copyBtn" onClick={handleCopyLink}>
            {copied ? (
              <>
                <CheckIcon style={{ fontSize: "1.1rem", color: "#46d369" }} />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <ContentCopyIcon style={{ fontSize: "1.1rem" }} />
                <span>Copy Invite Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Body: Player (Left) + Chat (Right) */}
      <div className="watchRoom__body">
        <div className="watchRoom__playerSection">
          <div className="watchRoom__playerWrapper">
            {trailerId ? (
              <YouTube
                videoId={trailerId}
                opts={opts}
                className="watchRoom__youtube"
                onReady={handlePlayerReady}
                onStateChange={handlePlayerStateChange}
              />
            ) : (
              <div className="watchRoom__noVideo">
                <p>Loading video stream...</p>
              </div>
            )}

            <FloatingReactions
              onSendReaction={handleSendReaction}
              incomingReaction={incomingReaction}
            />

            {syncNotice && (
              <div className="watchRoom__syncToast">
                <SyncIcon className="watchRoom__spin" />
                <span>{syncNotice}</span>
              </div>
            )}
          </div>

          <div className="watchRoom__controlsBar">
            <div className="watchRoom__controlsInfo">
              {isHost ? (
                <span className="watchRoom__controlRole isHost">
                  👑 <strong>Host Mode</strong> — Play, pause, or seek controls synchronize all viewers.
                </span>
              ) : (
                <span className="watchRoom__controlRole">
                  🔒 <strong>Guest Mode</strong> — Video playback is synchronized with the host.
                </span>
              )}
            </div>

            {isHost && (
              <div className="watchRoom__hostButtons">
                <button
                  className="watchRoom__hostBtn"
                  onClick={handleHostForcePlay}
                  title="Play for everyone"
                >
                  <PlayArrowIcon /> Play
                </button>
                <button
                  className="watchRoom__hostBtn"
                  onClick={handleHostForcePause}
                  title="Pause for everyone"
                >
                  <PauseIcon /> Pause
                </button>
                <button
                  className="watchRoom__hostBtn sync"
                  onClick={handleHostSyncAll}
                  title="Broadcast current timestamp"
                >
                  <SyncIcon /> Resync All
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="watchRoom__chatSection">
          <ChatSidebar
            users={users}
            messages={messages}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            currentUserName={userName}
          />
        </div>
      </div>
    </div>
  );
};

export default WatchRoom;
