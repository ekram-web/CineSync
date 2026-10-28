// LocalStorage Watchlist Helper for CineSync / Netflix Clone
const WATCHLIST_KEY = "cinesync_watchlist";

export const getWatchlist = () => {
  try {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading watchlist from localStorage:", error);
    return [];
  }
};

export const isInWatchlist = (movieId) => {
  if (!movieId) return false;
  const list = getWatchlist();
  return list.some((item) => item.id === movieId);
};

export const toggleWatchlist = (movie) => {
  if (!movie || !movie.id) return false;
  const list = getWatchlist();
  const exists = list.some((item) => item.id === movie.id);

  let updated;
  if (exists) {
    updated = list.filter((item) => item.id !== movie.id);
  } else {
    // Store only essential fields to keep localStorage clean
    const movieData = {
      id: movie.id,
      title: movie.title || movie.name || movie.original_name,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      vote_average: movie.vote_average,
      release_date: movie.release_date || movie.first_air_date,
    };
    updated = [movieData, ...list];
  }

  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
    // Dispatch a custom event so other components can re-render immediately
    window.dispatchEvent(new Event("watchlist_updated"));
  } catch (error) {
    console.error("Error saving watchlist:", error);
  }

  return !exists;
};
