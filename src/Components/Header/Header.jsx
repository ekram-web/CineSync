import React, { useState, useEffect, useRef } from "react";
import "./Header.css";
import netflix from "../../assets/images/netflix.png";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import StarRateIcon from "@mui/icons-material/StarRate";
import axios from "../../utils/axios";
import requests from "../../utils/requests";
import { getWatchlist } from "../../utils/watchlistStorage";

const base_url_thumb = "https://image.tmdb.org/t/p/w200";

const Header = ({
  currentView = "home",
  onNavigate,
  onSelectMovie,
  onOpenAiDiscovery,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const updateCount = () => {
    setWatchlistCount(getWatchlist().length);
  };

  useEffect(() => {
    updateCount();
    window.addEventListener("watchlist_updated", updateCount);
    return () => window.removeEventListener("watchlist_updated", updateCount);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await axios.get(
          `${requests.searchMovies}${encodeURIComponent(searchQuery)}`
        );
        const filtered = (res.data.results || []).filter(
          (m) => (m.poster_path || m.backdrop_path) && (m.title || m.name)
        );
        setSearchResults(filtered.slice(0, 8));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchResult = (movie) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    if (onSelectMovie) onSelectMovie(movie);
  };

  return (
    <header
      className={`header-outer-container ${
        isScrolled ? "header-outer-scrolled" : ""
      }`}
    >
      <div className="header-container">
        {/* Left: CineSync Brand Logo */}
        <div
          className="header-brandOnly"
          onClick={() => onNavigate && onNavigate("home")}
          title="CineSync Home"
        >
          <div className="header-logoCineSync">
            <svg className="header-logoSvg" viewBox="0 0 100 100" width="38" height="38">
              <defs>
                <linearGradient id="logoRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF1A2A" />
                  <stop offset="100%" stopColor="#B20710" />
                </linearGradient>
                <linearGradient id="logoPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF4D5A" />
                  <stop offset="100%" stopColor="#E50914" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="#141414" />
              <path
                d="M 68 28 C 60 20, 36 20, 28 32 C 18 46, 18 64, 28 78 C 38 90, 62 90, 72 82 C 74 80, 75 78, 72 75 C 69 72, 67 74, 64 76 C 56 82, 38 82, 32 72 C 24 60, 24 48, 32 38 C 38 30, 54 28, 62 34 C 65 36, 68 35, 68 28 Z"
                fill="url(#logoRedGrad)"
              />
              <polygon points="46,38 72,55 46,72" fill="url(#logoPlayGrad)" />
              <circle cx="76" cy="30" r="5" fill="#46D369" />
            </svg>
            <span className="header-logoText">
              CINE<span className="header-logoTextAccent">SYNC</span>
            </span>
          </div>
        </div>

        {/* Right: AI Match, My List, Search ONLY */}
        <div className="header-rightGroup">
          {/* 1. Search Bar */}
          <div className="header-searchContainer" ref={searchContainerRef}>
            <div
              className={`header-searchBar ${
                isSearchOpen ? "header-searchBar-open" : ""
              }`}
            >
              <SearchIcon
                className="header-searchIcon"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                title="Search movies"
              />
              <input
                ref={searchInputRef}
                type="text"
                className="header-searchInput"
                placeholder="Search titles, actors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <CloseIcon
                  className="header-searchClear"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                />
              )}
            </div>

            {/* Floating Search Dropdown */}
            {isSearchOpen && (searchQuery.trim() !== "" || isSearching) && (
              <div className="header-searchResults">
                {isSearching ? (
                  <div className="header-searchLoading">Searching titles...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((movie) => {
                    const title = movie.title || movie.name;
                    const year = (
                      movie.release_date ||
                      movie.first_air_date ||
                      ""
                    ).substring(0, 4);
                    const poster = movie.poster_path || movie.backdrop_path;
                    return (
                      <div
                        key={movie.id}
                        className="header-searchItem"
                        onClick={() => handleSelectSearchResult(movie)}
                      >
                        {poster && (
                          <img
                            src={`${base_url_thumb}${poster}`}
                            alt={title}
                            className="header-searchItemImg"
                          />
                        )}
                        <div className="header-searchItemInfo">
                          <span className="header-searchItemTitle">{title}</span>
                          <div className="header-searchItemMeta">
                            {year && <span>{year}</span>}
                            {movie.vote_average && (
                              <span className="header-searchItemRating">
                                <StarRateIcon style={{ fontSize: "0.85rem" }} />
                                {movie.vote_average.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="header-searchEmpty">
                    No matches found for "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. My List */}
          <button
            className={`header-listBtn ${currentView === "watchlist" ? "active" : ""}`}
            onClick={() => onNavigate && onNavigate("watchlist")}
            title="My Watchlist"
          >
            My List
            {watchlistCount > 0 && (
              <span className="header-badge">{watchlistCount}</span>
            )}
          </button>

          {/* 3. AI Match */}
          {onOpenAiDiscovery && (
            <button
              className="header-aiPill"
              onClick={onOpenAiDiscovery}
              title="Discover movies by vibe with Google Gemini"
            >
              <AutoAwesomeIcon className="header-aiIcon" />
              <span>AI Match</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
