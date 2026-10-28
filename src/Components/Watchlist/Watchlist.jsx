import React, { useEffect, useState } from "react";
import StarRateIcon from "@mui/icons-material/StarRate";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import { getWatchlist, toggleWatchlist } from "../../utils/watchlistStorage";
import "./watchlist.css";

const base_url = "https://image.tmdb.org/t/p/w500";

const Watchlist = ({ onSelectMovie, onBackToHome }) => {
  const [movies, setMovies] = useState([]);

  const loadWatchlist = () => {
    setMovies(getWatchlist());
  };

  useEffect(() => {
    loadWatchlist();
    window.addEventListener("watchlist_updated", loadWatchlist);
    return () => window.removeEventListener("watchlist_updated", loadWatchlist);
  }, []);

  const handleRemove = (e, movie) => {
    e.stopPropagation();
    toggleWatchlist(movie);
  };

  return (
    <div className="watchlist__container">
      <div className="watchlist__header">
        <button className="watchlist__backBtn" onClick={onBackToHome}>
          <ArrowBackIcon /> Back to Browse
        </button>
        <div className="watchlist__titleGroup">
          <h1>My Watchlist</h1>
          <span className="watchlist__count">{movies.length} {movies.length === 1 ? "movie" : "movies"}</span>
        </div>
      </div>

      {movies.length === 0 ? (
        <div className="watchlist__empty">
          <BookmarkBorderIcon className="watchlist__emptyIcon" />
          <h2>Your Watchlist is empty</h2>
          <p>Explore trending movies and click "+ Add to Watchlist" to save movies here for later or to watch with friends.</p>
          <button className="watchlist__browseBtn" onClick={onBackToHome}>
            Browse Movies
          </button>
        </div>
      ) : (
        <div className="watchlist__grid">
          {movies.map((movie) => {
            const poster = movie.poster_path || movie.backdrop_path;
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
            return (
              <div
                key={movie.id}
                className="watchlist__card"
                onClick={() => onSelectMovie(movie)}
              >
                <div className="watchlist__posterWrapper">
                  {poster ? (
                    <img
                      src={`${base_url}${poster}`}
                      alt={movie.title}
                      className="watchlist__poster"
                      loading="lazy"
                    />
                  ) : (
                    <div className="watchlist__noPoster">{movie.title}</div>
                  )}
                  <div className="watchlist__cardOverlay">
                    <button
                      className="watchlist__playBtn"
                      onClick={() => onSelectMovie(movie)}
                      title="View Details & Watch"
                    >
                      <PlayArrowIcon />
                    </button>
                    <button
                      className="watchlist__deleteBtn"
                      onClick={(e) => handleRemove(e, movie)}
                      title="Remove from Watchlist"
                    >
                      <DeleteOutlineIcon />
                    </button>
                  </div>
                </div>

                <div className="watchlist__cardInfo">
                  <h4 className="watchlist__cardTitle" title={movie.title}>
                    {movie.title}
                  </h4>
                  <div className="watchlist__cardMeta">
                    {rating && (
                      <span className="watchlist__cardRating">
                        <StarRateIcon className="watchlist__star" />
                        {rating}
                      </span>
                    )}
                    {movie.release_date && (
                      <span className="watchlist__cardYear">
                        {movie.release_date.substring(0, 4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
