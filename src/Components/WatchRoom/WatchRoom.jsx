import React, { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";
import movieTrailer from "movie-trailer";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SyncIcon from "@mui/icons-material/Sync";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import FastForwardIcon from "@mui/icons-material/FastForward";
import MovieIcon from "@mui/icons-material/Movie";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getSocket, getBroadcastChannel } from "../../utils/socketClient";
import ChatSidebar from "./ChatSidebar";
import FloatingReactions from "./FloatingReactions";
import "./watchRoom.css";

// Verified, universally embeddable fallback video streams
export const VERIFIED_TRAILERS = [
  { id: "L61p2uyiMSo", label: "Avatar 2 (Universal HD)" },
  { id: "YoHD9XEInc0", label: "Inception" },
  { id: "zSWdZVtXT7E", label: "Interstellar" },
  { id: "YE7VzlLtp-4", label: "Big Buck Bunny (100% Unrestricted)" },
];

const WatchRoom = ({
  roomId,
  initialMovie,
  initialTrailerUrl,
  initialIsHost = false,
  initialHostToken = "",
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
  const [hostName, setHostName] = useState(() => (initialIsHost ? userName || "Host" : "Host"));
  const [hostToken] = useState(() => {
    return initialHostToken || localStorage.getItem(`cinesync_host_token_${roomId}`) || "";
  });

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
  const [videoError, setVideoError] = useState("");
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [customVideoInput, setCustomVideoInput] = useState("");

  const playerRef = useRef(null);
  const isInternalAction = useRef(false);
  const isHostRef = useRef(isHost);
  const trailerIdRef = useRef(trailerId);
  const movieRef = useRef(movie);
  const usersRef = useRef(users);
  const pendingSyncRef = useRef(null);

  // Keep refs synchronized without triggering effect reruns
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    trailerIdRef.current = trailerId;
  }, [trailerId]);

  useEffect(() => {
    movieRef.current = movie;
  }, [movie]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Host Heartbeat: Broadcasts playback position every 2.5 seconds so all guests stay locked in sync
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      if (playerRef.current && !isInternalAction.current) {
        try {
          const state = playerRef.current.getPlayerState();
          // State 1 = playing, State 2 = paused
          if (state === 1 || state === 2) {
            const currentTime = playerRef.current.getCurrentTime() || 0;
            const action = state === 1 ? "play" : "pause";

            const payload = {
              roomId,
              action,
              timestamp: currentTime,
              hostTime: Date.now(),
              isHeartbeat: true,
            };

            const socket = getSocket();
            if (socket.connected) {
              socket.emit("sync_playback", payload);
            }

            const bc = getBroadcastChannel();
            if (bc) {
              bc.postMessage({ type: "sync_playback", ...payload });
            }
          }
        } catch (e) {}
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isHost, roomId]);

  // Helper to apply synchronized playback state to the local player
  const applySyncToPlayer = ({ action, timestamp, hostTime, isHeartbeat }) => {
    if (!playerRef.current) return;
    try {
      isInternalAction.current = true;
      const latencyComp = hostTime ? Math.max(0, (Date.now() - hostTime) / 1000) : 0;
      const targetTime = Math.max(0, timestamp + latencyComp);

      const curTime = playerRef.current.getCurrentTime() || 0;
      const timeDiff = Math.abs(curTime - targetTime);

      // Snap to time if drift is > 1.2s or if this is a manual seek/state change
      if (!isHeartbeat || timeDiff > 1.2) {
        playerRef.current.seekTo(targetTime, true);
      }

      const currentState = playerRef.current.getPlayerState();
      if (action === "play") {
        if (currentState !== 1) {
          playerRef.current.playVideo();
        }
      } else if (action === "pause") {
        if (currentState !== 2) {
          playerRef.current.pauseVideo();
        }
      }

      if (!isHeartbeat) {
        setSyncNotice(`Host ${action}ed at ${targetTime.toFixed(1)}s`);
        setTimeout(() => setSyncNotice(""), 2200);
      }

      setTimeout(() => {
        isInternalAction.current = false;
      }, 500);
    } catch (e) {
      isInternalAction.current = false;
    }
  };

  // Auto-fetch trailer if not provided
  useEffect(() => {
    if (!trailerId && movie) {
      const title = movie.title || movie.name || movie.original_name || "";
      movieTrailer(title)
        .then((url) => {
          if (url) {
            const urlParams = new URLSearchParams(new URL(url).search);
            const vId = urlParams.get("v");
            if (vId) {
              setTrailerId(vId);
              setVideoError("");
              return;
            }
          }
          setTrailerId(VERIFIED_TRAILERS[0].id);
        })
        .catch(() => {
          setTrailerId(VERIFIED_TRAILERS[0].id);
        });
    } else if (!trailerId && !movie) {
      setTrailerId(VERIFIED_TRAILERS[0].id);
    }
  }, [movie, trailerId]);

  // Main Real-Time Engine (Socket.IO + BroadcastChannel Fallback)
  // CRITICAL: Depend ONLY on [userName, roomId] to prevent infinite reconnect cycles!
  useEffect(() => {
    if (!userName || !roomId) return;

    const socket = getSocket();
    const bc = getBroadcastChannel();

    // 1. Connect Socket.IO
    try {
      socket.connect();
      socket.emit("join_room", {
        roomId,
        userName,
        movie: movieRef.current,
        trailerUrl: trailerIdRef.current,
        hostToken,
      });
    } catch (e) {
      console.warn("Socket connect error:", e);
    }

    // 2. Announce presence on BroadcastChannel
    if (bc) {
      bc.postMessage({
        type: "user_joined",
        roomId,
        user: userName,
        isHost: isHostRef.current,
        movie: movieRef.current,
        trailerId: trailerIdRef.current,
      });

      // If Guest, request current room state from Host
      if (!isHostRef.current) {
        bc.postMessage({
          type: "request_room_state",
          roomId,
          guestName: userName,
        });
      }
    }

    // --- Socket Event Handlers ---
    const handleRoomState = (state) => {
      // Determine host status from server verification or existing local hostToken
      const verifiedIsHost = state.isHost || isHostRef.current;
      setIsHost(verifiedIsHost);
      isHostRef.current = verifiedIsHost;

      if (state.hostName) setHostName(state.hostName);
      if (state.movie) setMovie(state.movie);
      if (state.trailerUrl) {
        setTrailerId(state.trailerUrl);
        setVideoError("");
      }
      if (state.users) setUsers(state.users);

      if (state.currentTime !== undefined) {
        const syncPayload = {
          action: state.isPlaying ? "play" : "pause",
          timestamp: state.currentTime,
          hostTime: Date.now(),
        };
        pendingSyncRef.current = syncPayload;
        if (playerRef.current) {
          applySyncToPlayer(syncPayload);
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
          id: `sys_${Date.now()}_${Math.random()}`,
          isSystem: true,
          text: data.message || `${data.user} joined the watch room!`,
        },
      ]);
    };

    const handleUserLeft = (data) => {
      if (data.users) setUsers(data.users);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}_${Math.random()}`,
          isSystem: true,
          text: data.message || `${data.user} left the room.`,
        },
      ]);
    };

    const handleSyncPlayback = (payload) => {
      pendingSyncRef.current = payload;
      if (playerRef.current) {
        applySyncToPlayer(payload);
      }
    };

    const handleVideoChanged = (data) => {
      if (data.trailerId) {
        setTrailerId(data.trailerId);
        setVideoError("");
        setSyncNotice(`🎬 Video stream updated`);
        setTimeout(() => setSyncNotice(""), 2500);
      }
      if (data.movieTitle) {
        setMovie((prev) => (prev ? { ...prev, title: data.movieTitle } : { title: data.movieTitle }));
      }
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}_${Math.random()}`, isSystem: true, text: data.message },
        ]);
      }
    };

    const handleReceiveMessage = (msg) => {
      setMessages((prev) => {
        // Prevent duplicate messages by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
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
      isHostRef.current = true;
      setSyncNotice("👑 You are now the Room Host!");
      setTimeout(() => setSyncNotice(""), 3000);
    };

    socket.on("room_state", handleRoomState);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("sync_playback", handleSyncPlayback);
    socket.on("video_changed", handleVideoChanged);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("receive_reaction", handleReceiveReaction);
    socket.on("promoted_to_host", handlePromotedToHost);

    // --- BroadcastChannel Fallback ---
    const handleBroadcastMessage = (event) => {
      const data = event.data;
      if (!data || data.roomId !== roomId) return;

      if (data.type === "request_room_state" && isHostRef.current) {
        let currentTime = 0;
        let isPlaying = false;
        try {
          if (playerRef.current) {
            currentTime = playerRef.current.getCurrentTime() || 0;
            isPlaying = playerRef.current.getPlayerState() === 1;
          }
        } catch (e) {}

        const updatedUsers = usersRef.current.some((u) => u.name === data.guestName)
          ? usersRef.current
          : [...usersRef.current, { id: `guest_${Date.now()}`, name: data.guestName, isHost: false }];

        setUsers(updatedUsers);

        bc.postMessage({
          type: "room_state",
          roomId,
          movie: movieRef.current,
          trailerId: trailerIdRef.current,
          hostName: userName,
          users: updatedUsers,
          isPlaying,
          currentTime,
        });

        setMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}_${Math.random()}`, isSystem: true, text: `${data.guestName} joined the watch room!` },
        ]);
      } else if (data.type === "room_state") {
        if (data.movie) setMovie(data.movie);
        if (data.trailerId) {
          setTrailerId(data.trailerId);
          setVideoError("");
        }
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
      } else if (data.type === "video_changed") {
        handleVideoChanged(data);
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
      socket.off("video_changed", handleVideoChanged);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("receive_reaction", handleReceiveReaction);
      socket.off("promoted_to_host", handlePromotedToHost);

      if (bc) {
        bc.removeEventListener("message", handleBroadcastMessage);
      }

      socket.disconnect();
    };
  }, [userName, roomId]);

  // Host Action: Emit playback events to all peers
  const emitPlayback = (action, forcedTime = null) => {
    if (!playerRef.current || isInternalAction.current) return;

    try {
      const currentTime = forcedTime !== null ? forcedTime : playerRef.current.getCurrentTime() || 0;
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
      console.warn("Player emit error:", e);
    }
  };

  const handlePlayerReady = (event) => {
    playerRef.current = event.target;
    setVideoError("");

    // If a sync state was queued before player mounted, apply it immediately
    if (pendingSyncRef.current) {
      applySyncToPlayer(pendingSyncRef.current);
    } else if (!isHostRef.current) {
      // Guest with no initial state: pause until host position is received
      try {
        event.target.pauseVideo();
      } catch (e) {}
    }
  };

  const handlePlayerError = (event) => {
    console.warn("YouTube player error:", event?.data);
    setVideoError("YouTube playback is restricted or blocked on this network.");
  };

  const handlePlayerStateChange = (event) => {
    if (isInternalAction.current) return;

    if (isHostRef.current) {
      try {
        const curTime = playerRef.current ? playerRef.current.getCurrentTime() || 0 : 0;
        if (event.data === 1) {
          // Playing
          emitPlayback("play", curTime);
        } else if (event.data === 2) {
          // Paused
          emitPlayback("pause", curTime);
        } else if (event.data === 3) {
          // Buffering or seek scrub
          emitPlayback("pause", curTime);
        }
      } catch (e) {}
    }
  };

  // Host Controls
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

  const handleHostSkip = (seconds) => {
    if (playerRef.current) {
      try {
        const cur = playerRef.current.getCurrentTime() || 0;
        const newTime = Math.max(0, cur + seconds);
        playerRef.current.seekTo(newTime, true);
        const isPlaying = playerRef.current.getPlayerState() === 1;
        emitPlayback(isPlaying ? "play" : "pause", newTime);
        setSyncNotice(`${seconds > 0 ? "+10s" : "-10s"} seek broadcasted`);
        setTimeout(() => setSyncNotice(""), 2000);
      } catch (e) {}
    }
  };

  const handleHostSyncAll = () => {
    if (playerRef.current) {
      try {
        const state = playerRef.current.getPlayerState();
        const cur = playerRef.current.getCurrentTime() || 0;
        emitPlayback(state === 1 ? "play" : "pause", cur);
        setSyncNotice("Sync signal broadcasted to all viewers");
        setTimeout(() => setSyncNotice(""), 2200);
      } catch (e) {}
    }
  };

  // Guest Control: Catch Up with Host
  const handleGuestCatchUp = () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("join_room", { roomId, userName, hostToken: "" });
      setSyncNotice("Requesting host stream position...");
      setTimeout(() => setSyncNotice(""), 2200);
    }
    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage({ type: "request_room_state", roomId, guestName: userName });
    }
  };

  // Change Video / Trailer (Host action)
  const handleChangeVideo = (newTrailerId, newTitle = "") => {
    if (!newTrailerId) return;

    // Extract ID if full URL pasted
    let cleanId = newTrailerId.trim();
    if (cleanId.includes("youtube.com/watch")) {
      const match = cleanId.match(/v=([a-zA-Z0-9_-]+)/);
      if (match) cleanId = match[1];
    } else if (cleanId.includes("youtu.be/")) {
      const match = cleanId.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match) cleanId = match[1];
    }

    setTrailerId(cleanId);
    setVideoError("");
    setIsChangeVideoOpen(false);
    setCustomVideoInput("");

    const displayTitle = newTitle || (movie?.title || "Stream Video");
    const payload = {
      roomId,
      trailerId: cleanId,
      movieTitle: displayTitle,
    };

    const socket = getSocket();
    if (socket.connected) {
      socket.emit("change_video", payload);
    }

    const bc = getBroadcastChannel();
    if (bc) {
      bc.postMessage({
        type: "video_changed",
        trailerId: cleanId,
        movieTitle: displayTitle,
        message: `Host switched video stream to "${displayTitle}"`,
      });
    }

    setSyncNotice("Video stream updated for all viewers");
    setTimeout(() => setSyncNotice(""), 2500);
  };

  // Chat & Messaging
  const handleSendMessage = (messageText) => {
    const payload = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user: userName,
      isHost,
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

  // Floating Reactions
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

  // Copy Invite Link (both Host & Guest can invite friends!)
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
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
      controls: isHost ? 1 : 0, // ONLY HOST has active player controls
    },
  };

  return (
    <div className="watchRoom__container">
      {/* Display Name Modal if joining without saved name */}
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

      {/* Change Video Modal (Host Only) */}
      {isChangeVideoOpen && (
        <div className="watchRoom__nameModalOverlay" onClick={() => setIsChangeVideoOpen(false)}>
          <div className="watchRoom__changeVideoModal" onClick={(e) => e.stopPropagation()}>
            <h3>🎬 Change Video Stream</h3>
            <p>Pick a verified trailer or paste any YouTube URL to switch stream for all viewers:</p>

            <div className="watchRoom__verifiedList">
              {VERIFIED_TRAILERS.map((v) => (
                <button
                  key={v.id}
                  className={`watchRoom__trailerOption ${trailerId === v.id ? "active" : ""}`}
                  onClick={() => handleChangeVideo(v.id, v.label)}
                >
                  <MovieIcon style={{ fontSize: "1rem" }} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>

            <div className="watchRoom__customVideoBox">
              <input
                type="text"
                className="watchRoom__nameInput"
                placeholder="Paste YouTube Video URL or Video ID..."
                value={customVideoInput}
                onChange={(e) => setCustomVideoInput(e.target.value)}
              />
              <div className="watchRoom__customBtnRow">
                <button
                  className="watchRoom__nameSubmitBtn"
                  disabled={!customVideoInput.trim()}
                  onClick={() => handleChangeVideo(customVideoInput, "Custom Video")}
                >
                  Switch Video for Everyone
                </button>
                <button
                  className="watchRoom__cancelBtn"
                  onClick={() => setIsChangeVideoOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
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
                <span className="watchRoom__hostBadge guestBadge">
                  🔒 Guest (Host: {hostName || "Host"})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="watchRoom__headerRight">
          <button
            className="watchRoom__copyBtn"
            onClick={handleCopyLink}
            title="Invite friends to this watch room"
          >
            {copied ? (
              <>
                <CheckIcon style={{ fontSize: "1.1rem", color: "#46d369" }} />
                <span>Invite Link Copied!</span>
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
                onError={handlePlayerError}
                onStateChange={handlePlayerStateChange}
              />
            ) : (
              <div className="watchRoom__noVideo">
                <p>Loading video stream...</p>
              </div>
            )}

            {/* Guest Interaction Shield: Keeps guests strictly locked in sync with Host */}
            {!isHost && (
              <div className="watchRoom__guestShield" title="Video playback is controlled by Host">
                <div className="watchRoom__guestShieldBadge">
                  <span>🔒 Synced to Host</span>
                </div>
              </div>
            )}

            {/* Video Error / Restriction Overlay */}
            {videoError && (
              <div className="watchRoom__videoErrorOverlay">
                <WarningAmberIcon style={{ fontSize: "2.4rem", color: "#ffc107" }} />
                <h4>YouTube Video Restricted</h4>
                <p>
                  This video is restricted or cannot be embedded on this network / account.
                </p>
                {isHost ? (
                  <div className="watchRoom__errorActions">
                    <p className="watchRoom__errorHint">As Host, select a tested stream below:</p>
                    <div className="watchRoom__quickOptions">
                      {VERIFIED_TRAILERS.map((v) => (
                        <button
                          key={v.id}
                          className="watchRoom__quickOptionBtn"
                          onClick={() => handleChangeVideo(v.id, v.label)}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="watchRoom__errorGuestNote">
                    Please ask the Host ({hostName || "Host"}) to select a compatible trailer.
                  </p>
                )}
              </div>
            )}

            {/* Floating Reactions Canvas */}
            <FloatingReactions
              onSendReaction={handleSendReaction}
              incomingReaction={incomingReaction}
            />

            {/* Sync Notification Toast */}
            {syncNotice && (
              <div className="watchRoom__syncToast">
                <SyncIcon className="watchRoom__spin" />
                <span>{syncNotice}</span>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="watchRoom__controlsBar">
            <div className="watchRoom__controlsInfo">
              {isHost ? (
                <span className="watchRoom__controlRole isHost">
                  👑 <strong>Host Mode</strong> — You control playback and sync for all viewers.
                </span>
              ) : (
                <span className="watchRoom__controlRole">
                  🔒 <strong>Guest Mode</strong> — Video is synchronized with Host ({hostName || "Host"}). Sit back and enjoy!
                </span>
              )}
            </div>

            {/* Host Controls */}
            {isHost ? (
              <div className="watchRoom__hostButtons">
                <button
                  className="watchRoom__hostBtn"
                  onClick={handleHostForcePlay}
                  title="Play for everyone"
                >
                  <PlayArrowIcon style={{ fontSize: "1.1rem" }} /> Play
                </button>
                <button
                  className="watchRoom__hostBtn"
                  onClick={handleHostForcePause}
                  title="Pause for everyone"
                >
                  <PauseIcon style={{ fontSize: "1.1rem" }} /> Pause
                </button>
                <button
                  className="watchRoom__hostBtn"
                  onClick={() => handleHostSkip(-10)}
                  title="Rewind 10 seconds"
                >
                  <FastRewindIcon style={{ fontSize: "1.1rem" }} /> -10s
                </button>
                <button
                  className="watchRoom__hostBtn"
                  onClick={() => handleHostSkip(10)}
                  title="Forward 10 seconds"
                >
                  <FastForwardIcon style={{ fontSize: "1.1rem" }} /> +10s
                </button>
                <button
                  className="watchRoom__hostBtn sync"
                  onClick={handleHostSyncAll}
                  title="Broadcast current timestamp to all guests"
                >
                  <SyncIcon style={{ fontSize: "1.1rem" }} /> Resync All
                </button>
                <button
                  className="watchRoom__hostBtn changeVideo"
                  onClick={() => setIsChangeVideoOpen(true)}
                  title="Change video or trailer"
                >
                  <MovieIcon style={{ fontSize: "1.1rem" }} /> Change Video
                </button>
              </div>
            ) : (
              /* Guest Controls */
              <div className="watchRoom__guestButtons">
                <button
                  className="watchRoom__guestSyncBtn"
                  onClick={handleGuestCatchUp}
                  title="Resync video to host's position"
                >
                  <SyncIcon style={{ fontSize: "1.05rem" }} /> Catch Up with Host
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Chat Sidebar */}
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
