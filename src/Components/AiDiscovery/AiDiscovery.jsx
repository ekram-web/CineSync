import React, { useState, useEffect, useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import StarRateIcon from "@mui/icons-material/StarRate";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { getAiMovieRecommendations } from "../../utils/geminiAi";
import { isInWatchlist, toggleWatchlist } from "../../utils/watchlistStorage";
import "./aiDiscovery.css";

const base_url = "https://image.tmdb.org/t/p/w500";

const QUICK_VIBES = [
  "🌧️ Rainy Sunday Comfort",
  "🧠 Mind-Bending Sci-Fi",
  "🔥 High-Octane Action",
  "🍿 Hilarious Comedy for Friends",
  "💔 Deep Emotional Drama",
  "👻 Psychological Thriller",
];

const AiDiscovery = ({ onClose, onSelectMovie }) => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hey! I'm CineSync AI. Describe your mood, a favorite movie, or a specific vibe, and I'll find your perfect match.",
      movies: [],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSend = async (promptText) => {
    const query = (promptText || inputText).trim();
    if (!query || isLoading) return;

    setInputText("");

    // Append user message
    const userMsg = { role: "user", text: query };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const historyContext = updatedMessages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await getAiMovieRecommendations(query, historyContext);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.message,
          movies: response.movies || [],
        },
      ]);
    } catch (err) {
      console.error("AI recommendation error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I had trouble processing that request. Try choosing a vibe chip below or rephrasing your search!",
          movies: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVibeClick = (vibe) => {
    handleSend(vibe);
  };

  const handleToggleWatchlist = (e, movie) => {
    e.stopPropagation();
    if (!movie?.tmdb) return;
    toggleWatchlist(movie.tmdb);
    // Force re-render of button
    setMessages([...messages]);
  };

  const handleCardClick = (movie) => {
    if (movie.tmdb && onSelectMovie) {
      onSelectMovie(movie.tmdb);
      onClose();
    }
  };

  return (
    <div className="aiModal__overlay" onClick={onClose}>
      <div className="aiModal__container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="aiModal__header">
          <div className="aiModal__headerTitle">
            <div className="aiModal__iconWrapper">
              <AutoAwesomeIcon className="aiModal__sparkleIcon" />
            </div>
            <div>
              <h2>CineSync AI Movie Match</h2>
              <p>Powered by Google Gemini & TMDB</p>
            </div>
          </div>
          <button className="aiModal__closeBtn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Quick Vibe Chips */}
        <div className="aiModal__chipsContainer">
          <span className="aiModal__chipsLabel">Try a vibe:</span>
          <div className="aiModal__chips">
            {QUICK_VIBES.map((vibe) => (
              <button
                key={vibe}
                className="aiModal__chip"
                onClick={() => handleVibeClick(vibe)}
                disabled={isLoading}
              >
                {vibe}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Feed */}
        <div className="aiModal__chatFeed">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`aiModal__messageRow ${
                msg.role === "user" ? "userRow" : "assistantRow"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="aiModal__avatar">
                  <AutoAwesomeIcon style={{ fontSize: "1rem" }} />
                </div>
              )}

              <div className="aiModal__bubbleWrapper">
                <div className={`aiModal__bubble ${msg.role}Bubble`}>
                  {msg.text}
                </div>

                {/* Movie Cards Grid if Assistant returned titles */}
                {msg.movies && msg.movies.length > 0 && (
                  <div className="aiModal__moviesGrid">
                    {msg.movies.map((item, mIdx) => {
                      const tmdb = item.tmdb;
                      const poster = tmdb?.poster_path || tmdb?.backdrop_path;
                      const title = tmdb?.title || item.title;
                      const year =
                        (tmdb?.release_date || "").substring(0, 4) || item.year;
                      const rating = tmdb?.vote_average
                        ? tmdb.vote_average.toFixed(1)
                        : null;
                      const isSaved = tmdb ? isInWatchlist(tmdb.id) : false;

                      return (
                        <div
                          key={mIdx}
                          className="aiModal__movieCard"
                          onClick={() => handleCardClick(item)}
                        >
                          <div className="aiModal__posterCol">
                            {poster ? (
                              <img
                                src={`${base_url}${poster}`}
                                alt={title}
                                className="aiModal__cardPoster"
                              />
                            ) : (
                              <div className="aiModal__cardNoPoster">
                                🎬 {title}
                              </div>
                            )}
                          </div>

                          <div className="aiModal__infoCol">
                            <div className="aiModal__cardHeader">
                              <h4 className="aiModal__cardTitle">{title}</h4>
                              <div className="aiModal__cardMeta">
                                {year && <span>{year}</span>}
                                {rating && (
                                  <span className="aiModal__cardRating">
                                    <StarRateIcon style={{ fontSize: "0.85rem" }} />
                                    {rating}
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.vibeTags && item.vibeTags.length > 0 && (
                              <div className="aiModal__vibeTags">
                                {item.vibeTags.map((tag, tIdx) => (
                                  <span key={tIdx} className="aiModal__vibeTag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="aiModal__cardReason">{item.reason}</p>

                            <div className="aiModal__cardActions">
                              <button
                                className="aiModal__actionBtnPrimary"
                                onClick={() => handleCardClick(item)}
                              >
                                <PlayArrowIcon style={{ fontSize: "1rem" }} />
                                Details & Watch
                              </button>

                              {tmdb && (
                                <button
                                  className={`aiModal__actionBtnSecondary ${
                                    isSaved ? "saved" : ""
                                  }`}
                                  onClick={(e) => handleToggleWatchlist(e, item)}
                                  title={isSaved ? "In Watchlist" : "Save to Watchlist"}
                                >
                                  {isSaved ? (
                                    <BookmarkIcon style={{ fontSize: "1rem" }} />
                                  ) : (
                                    <BookmarkBorderIcon style={{ fontSize: "1rem" }} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking / Loading Animation */}
          {isLoading && (
            <div className="aiModal__messageRow assistantRow">
              <div className="aiModal__avatar">
                <AutoAwesomeIcon style={{ fontSize: "1rem" }} />
              </div>
              <div className="aiModal__bubble assistantBubble aiModal__thinking">
                <span className="aiModal__dot" />
                <span className="aiModal__dot" />
                <span className="aiModal__dot" />
                <span className="aiModal__thinkingText">Gemini is curating films...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="aiModal__inputBar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="aiModal__inputField"
            placeholder="Type a mood, vibe, or movie you loved..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="aiModal__sendBtn"
            disabled={!inputText.trim() || isLoading}
            aria-label="Send"
          >
            <SendIcon style={{ fontSize: "1.1rem" }} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiDiscovery;
