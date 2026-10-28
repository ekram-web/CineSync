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
        {/* Left: ONLY the Logo */}
        <div
          className="header-brandOnly"
          onClick={() => onNavigate && onNavigate("home")}
          title="Home"
        >
          <img src={netflix} alt="Netflix / CineSync" className="header-logoImg" />
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
