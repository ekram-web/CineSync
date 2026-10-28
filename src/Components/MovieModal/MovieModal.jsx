import React, { useEffect, useState } from "react";
import YouTube from "react-youtube";
import movieTrailer from "movie-trailer";
import CloseIcon from "@mui/icons-material/Close";
import StarRateIcon from "@mui/icons-material/StarRate";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import GroupsIcon from "@mui/icons-material/Groups";
import { isInWatchlist, toggleWatchlist } from "../../utils/watchlistStorage";
import "./movieModal.css";

const base_url = "https://image.tmdb.org/t/p/original";

const MovieModal = ({ movie, onClose, onCreateRoom }) => {
  const [trailerUrl, setTrailerUrl] = useState("");
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [trailerError, setTrailerError] = useState("");

  useEffect(() => {
    if (!movie) return;
    setInWatchlist(isInWatchlist(movie.id));
    setTrailerError("");
    setTrailerUrl("");

    // Try fetching trailer automatically
    setIsTrailerLoading(true);
    const movieName = movie?.title || movie?.name || movie?.original_name || "";
    movieTrailer(movieName)
      .then((url) => {
        if (url) {
          const urlParams = new URLSearchParams(new URL(url).search);
          const videoId = urlParams.get("v");
          setTrailerUrl(videoId || "");
        } else {
          setTrailerError("No official trailer found for this title.");
        }
      })
      .catch(() => {
        setTrailerError("Could not load trailer.");
      })
      .finally(() => {
        setIsTrailerLoading(false);
      });

    // Close on Escape key
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [movie]);

  if (!movie) return null;

  const title = movie?.title || movie?.name || movie?.original_name || "Unknown Title";
  const releaseYear = (movie?.release_date || movie?.first_air_date || "").substring(0, 4);
  const rating = movie?.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const backdrop = movie?.backdrop_path || movie?.poster_path;

  const handleWatchlistToggle = () => {
    const newState = toggleWatchlist(movie);
    setInWatchlist(newState);
  };

  const handleCreateWatchRoom = () => {
    if (onCreateRoom) {
      const generatedRoomId = `room_${Math.random().toString(36).substring(2, 8)}`;
      onCreateRoom(movie, generatedRoomId, trailerUrl);
    }
  };

  const opts = {
    height: "360",
    width: "100%",
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="movieModal__overlay" onClick={onClose}>
      <div className="movieModal__content" onClick={(e) => e.stopPropagation()}>
        <button className="movieModal__closeBtn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        {/* Video Trailer or Backdrop Header */}
        <div className="movieModal__mediaContainer">
          {trailerUrl ? (
            <div className="movieModal__youtubeWrapper">
              <YouTube videoId={trailerUrl} opts={opts} className="movieModal__youtube" />
            </div>
          ) : (
            <div
              className="movieModal__backdrop"
              style={{
                backgroundImage: backdrop ? `url(${base_url}${backdrop})` : "none",
              }}
            >
              <div className="movieModal__backdropFade" />
              {isTrailerLoading && (
                <div className="movieModal__loadingTrailer">
                  <div className="movieModal__spinner" />
                  <span>Loading official trailer...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details & Actions */}
        <div className="movieModal__body">
          <div className="movieModal__header">
            <h2 className="movieModal__title">{title}</h2>
            <div className="movieModal__meta">
              {releaseYear && <span className="movieModal__year">{releaseYear}</span>}
              <span className="movieModal__rating">
                <StarRateIcon className="movieModal__star" />
                {rating} / 10
              </span>
              {movie.vote_count && (
                <span className="movieModal__votes">({movie.vote_count} votes)</span>
              )}
            </div>
          </div>

          <div className="movieModal__actions">
            <button
              className="movieModal__btn movieModal__btnPrimary"
              onClick={handleCreateWatchRoom}
            >
              <GroupsIcon className="movieModal__btnIcon" />
              🎬 Create Watch Room
            </button>

            <button
              className={`movieModal__btn ${
                inWatchlist ? "movieModal__btnSaved" : "movieModal__btnSecondary"
              }`}
              onClick={handleWatchlistToggle}
            >
              {inWatchlist ? (
                <>
                  <BookmarkIcon className="movieModal__btnIcon" />
                  ✓ In Watchlist
                </>
              ) : (
                <>
                  <BookmarkBorderIcon className="movieModal__btnIcon" />
                  ➕ Add to Watchlist
                </>
              )}
            </button>
          </div>

          {trailerError && !trailerUrl && !isTrailerLoading && (
            <div className="movieModal__notice">{trailerError}</div>
          )}

          <div className="movieModal__overviewSection">
            <h3>Overview</h3>
            <p className="movieModal__overview">
              {movie.overview || "No overview available for this title."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieModal;
