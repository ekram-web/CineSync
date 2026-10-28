import React, { useEffect, useState } from "react";
import axios from "../../utils/axios";
import requests from "../../utils/requests";
import { isInWatchlist, toggleWatchlist } from "../../utils/watchlistStorage";
import "./banner.css";

const Banner = ({ onSelectMovie }) => {
  // Helper function to shorten long text and add "... " if it exceeds
  let truncate = (text, maxLength) => {
    return text?.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  const [movie, setMovie] = useState({});
  const [inList, setInList] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const request = await axios.get(requests.fetchNetflixOriginals);
        const randomMovie =
          request.data.results[
            Math.floor(Math.random() * request.data.results.length)
          ];
        setMovie(randomMovie);
        if (randomMovie) {
          setInList(isInWatchlist(randomMovie.id));
        }
      } catch (error) {
        console.log("error", error);
      }
    })();
  }, []);

  const handleToggleList = () => {
    if (!movie?.id) return;
    const newState = toggleWatchlist(movie);
    setInList(newState);
  };

  return (
    <div
      className="banner"
      style={{
        backgroundImage: movie?.backdrop_path
          ? `url('https://image.tmdb.org/t/p/original${movie.backdrop_path}')`
          : "none",
      }}
    >
      <div className="banner-contents">
        <h1 className="banner-title">
          {movie?.title || movie?.name || movie?.original_name}
        </h1>
        <div className="banner-buttons">
          <button
            className="banner-button play"
            onClick={() => onSelectMovie && onSelectMovie(movie)}
          >
            ▶ Play
          </button>
          <button
            className={`banner-button ${inList ? "banner-button-saved" : ""}`}
            onClick={handleToggleList}
          >
            {inList ? "✓ In List" : "+ My List"}
          </button>
          <button
            className="banner-button"
            onClick={() => onSelectMovie && onSelectMovie(movie)}
          >
            ⓘ More Info
          </button>
        </div>
        <h1 className="banner-description">{truncate(movie?.overview, 150)}</h1>
      </div>
      <div className="banner-fadeBottom"></div>
    </div>
  );
};

export default Banner;
