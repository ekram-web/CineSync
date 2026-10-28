import React, { useState } from "react";
import Header from "../../Components/Header/Header.jsx";
import Footer from "../../Components/Footer/Footer.jsx";
import Banner from "../../Components/Banner/Banner.jsx";
import Rowlist from "../../Components/Rows/RowList/Rowlist.jsx";
import MovieModal from "../../Components/MovieModal/MovieModal.jsx";
import Watchlist from "../../Components/Watchlist/Watchlist.jsx";
import AiDiscovery from "../../Components/AiDiscovery/AiDiscovery.jsx";

const Home = () => {
  const [currentView, setCurrentView] = useState("home"); // "home" | "watchlist"
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleSelectMovie = (movie) => {
    setSelectedMovie(movie);
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const handleCreateRoom = (movie, roomId, trailerUrl) => {
    setSelectedMovie(null);
    alert(`🎬 Watch Room created: "${roomId}" for "${movie.title || movie.name}". Real-time room sync ready for next phase!`);
  };

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
