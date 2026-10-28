// Imports: React hooks, CSS, your custom axios instance, a package to find YouTube trailers, and a YouTube embed component.

import React, { useEffect, useState } from "react";
import "./row.css";
import axios from "../../../utils/axios";
import movieTrailer from "movie-trailer";
import YouTube from "react-youtube";

// Defines the Row component with props for the row title, the API endpoint, and a flag for large posters.

const Row = ({ title, fetchUrl, isLargeRow, onSelectMovie }) => {
  // stores the list of movies fetched from the API.
  const [movies, setMovies] = useState([]);

  // stores the YouTube video ID for the trailer.
  const [trailerUrl, setTrailerUrl] = useState("");

  // base URL for movie images.
  const base_url = "https://image.tmdb.org/t/p/original";

  // Fetches movies from the API when the component mounts or when fetchUrl changes, and saves them to state.
  useEffect(() => {
    (async () => {
      try {
        console.log(fetchUrl);
        const request = await axios.get(fetchUrl);
        // console.log(request);
        setMovies(request.data.results);
      } catch (error) {
        console.log("Error fetching movies:", error);
      }
    })();
  }, [fetchUrl]);

  /*  

# When a movie poster is clicked:
    - If onSelectMovie is provided, open the Movie Modal with full details.
    - Otherwise, falls back to inline trailer toggle.
*/

  const handleClick = (movie) => {
    if (onSelectMovie) {
      onSelectMovie(movie);
      return;
    }
    if (trailerUrl) {
      setTrailerUrl("");
    } else {
      movieTrailer(movie?.title || movie?.name || movie?.original_name)
        .then((url) => {
          if (url) {
            // console.log("Trailer URL:", url);
            const urlParams = new URLSearchParams(new URL(url).search);
            // console.log("URL Params:", urlParams);
            const videoId = urlParams.get("v");
            // console.log("Video ID:", videoId);
            setTrailerUrl(videoId);
          } else {
            console.log("No trailer found for this movie.");
          }
        })
        .catch((error) => console.log("Error fetching trailer:", error));
    }
  };

  const opts = {
    height: "390",
    width: "100%",
    playerVars: { autoplay: 1 },
  };

  const validMovies = movies?.filter((movie) =>
    isLargeRow ? movie?.poster_path : (movie?.backdrop_path || movie?.poster_path)
  );

  return (
    <div className="row">
      <h2 className="row-title">{title}</h2>
      <div className="row-posters">
        {validMovies?.map((movie, index) => {
          const imagePath = isLargeRow
            ? movie.poster_path
            : (movie.backdrop_path || movie.poster_path);
          return (
            <img
              onClick={() => handleClick(movie)}
              key={movie.id || index}
              src={`${base_url}${imagePath}`}
              alt={movie.title || movie.name || "Movie"}
              className={`row-poster ${isLargeRow ? "row-posterLarge" : ""}`}
              loading="lazy"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          );
        })}
      </div>
      {trailerUrl && (
        <div className="row-trailerWrapper">
          <YouTube videoId={trailerUrl} opts={opts} />
        </div>
      )}
    </div>
  );
};

export default Row;
