import React, { useEffect, useState } from "react";

const EMOJIS = ["❤️", "😂", "🍿", "😮", "🔥", "👏"];

const FloatingReactions = ({ onSendReaction, incomingReaction }) => {
  const [floatingList, setFloatingList] = useState([]);

  useEffect(() => {
    if (!incomingReaction || !incomingReaction.emoji) return;

    const reactionItem = {
      id: incomingReaction.id || Math.random(),
      emoji: incomingReaction.emoji,
      left: 60 + Math.random() * 30, // random position on right side
    };

    setFloatingList((prev) => [...prev, reactionItem]);

    // Remove after animation finishes
    const timer = setTimeout(() => {
      setFloatingList((prev) => prev.filter((r) => r.id !== reactionItem.id));
    }, 2400);

    return () => clearTimeout(timer);
  }, [incomingReaction]);

  const handleEmojiClick = (emoji) => {
    if (onSendReaction) onSendReaction(emoji);
  };

  return (
    <>
      {/* Floating Animated Emojis Layer */}
      <div className="floatingReactions__layer">
        {floatingList.map((item) => (
          <div
            key={item.id}
            className="floatingReactions__particle"
            style={{ left: `${item.left}%` }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Reaction Buttons Bar */}
      <div className="floatingReactions__buttonBar">
        <span className="floatingReactions__barLabel">React:</span>
        <div className="floatingReactions__emojis">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              className="floatingReactions__emojiBtn"
              onClick={() => handleEmojiClick(emoji)}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default FloatingReactions;
