import React, { useState, useEffect } from "react";
import Header from "../../Components/Header/Header.jsx";
import Footer from "../../Components/Footer/Footer.jsx";
import Banner from "../../Components/Banner/Banner.jsx";
import Rowlist from "../../Components/Rows/RowList/Rowlist.jsx";
import MovieModal from "../../Components/MovieModal/MovieModal.jsx";
import Watchlist from "../../Components/Watchlist/Watchlist.jsx";
import AiDiscovery from "../../Components/AiDiscovery/AiDiscovery.jsx";
import WatchRoom from "../../Components/WatchRoom/WatchRoom.jsx";

const Home = () => {
  const [currentView, setCurrentView] = useState("home"); // "home" | "watchlist"
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);

  // Check URL query parameters for invite link on load (e.g. ?room=room_abc123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      let saved = null;
      try {
        const raw = localStorage.getItem(`cinesync_room_${roomParam}`);
        if (raw) saved = JSON.parse(raw);
      } catch (e) {}

      // Creator session check
      const currentUserName = localStorage.getItem("cinesync_username") || "";
      const isCreator = saved?.hostName && currentUserName && saved.hostName === currentUserName;

      setActiveRoom({
        roomId: roomParam,
        movie: saved?.movie || null,
        trailerUrl: saved?.trailerUrl || "",
        isHost: Boolean(isCreator),
      });
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const r = p.get("room");
      if (r) {
        let saved = null;
        try {
          const raw = localStorage.getItem(`cinesync_room_${r}`);
          if (raw) saved = JSON.parse(raw);
        } catch (e) {}

        setActiveRoom({
          roomId: r,
          movie: saved?.movie || null,
          trailerUrl: saved?.trailerUrl || "",
          isHost: false,
        });
      } else {
        setActiveRoom(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectMovie = (movie) => {
    setSelectedMovie(movie);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const handleCreateRoom = (movie, roomId, trailerUrl) => {
    const currentUserName = localStorage.getItem("cinesync_username") || "Host";
    const roomPayload = {
      roomId,
      movie,
      trailerUrl,
      hostName: currentUserName,
      createdAt: Date.now(),
    };

    try {
      localStorage.setItem(`cinesync_room_${roomId}`, JSON.stringify(roomPayload));
    } catch (e) {}

    setSelectedMovie(null);
    setActiveRoom({
      roomId,
      movie,
      trailerUrl,
      isHost: true,
    });
    window.history.pushState({}, "", `?room=${roomId}`);
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  // If in an active Watch Room, render the Cinema Theater layout
  if (activeRoom) {
    return (
      <WatchRoom
        roomId={activeRoom.roomId}
        initialMovie={activeRoom.movie}
        initialTrailerUrl={activeRoom.trailerUrl}
        initialIsHost={activeRoom.isHost}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div style={{ backgroundColor: "#111", minHeight: "100vh" }}>
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onSelectMovie={handleSelectMovie}
        onOpenAiDiscovery={() => setIsAiModalOpen(true)}
      />

      {currentView === "home" && (
        <>
          <Banner onSelectMovie={handleSelectMovie} />
          <Rowlist onSelectMovie={handleSelectMovie} />
        </>
      )}

      {currentView === "watchlist" && (
        <Watchlist
          onSelectMovie={handleSelectMovie}
          onBackToHome={() => setCurrentView("home")}
        />
      )}

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={handleCloseModal}
          onCreateRoom={handleCreateRoom}
        />
      )}

      {isAiModalOpen && (
        <AiDiscovery
          onClose={() => setIsAiModalOpen(false)}
          onSelectMovie={handleSelectMovie}
        />
      )}

      <Footer />
    </div>
  );
};

export default Home;
