import React, { useState, useEffect, useRef } from "react";
import SendIcon from "@mui/icons-material/Send";
import GroupsIcon from "@mui/icons-material/Groups";

const ChatSidebar = ({
  users = [],
  messages = [],
  typingUsers = [],
  onSendMessage,
  onTyping,
  currentUserName,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (onTyping) onTyping(false);
    onSendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <div className="chatSidebar__container">
      {/* Viewers Bar */}
      <div className="chatSidebar__viewersHeader">
        <div className="chatSidebar__viewersTitle">
          <GroupsIcon style={{ fontSize: "1.2rem" }} />
          <span>In Room ({users.length})</span>
        </div>
        <div className="chatSidebar__avatars">
          {users.map((u, i) => (
            <div
              key={u.id || i}
              className={`chatSidebar__avatarPill ${u.isHost ? "isHost" : ""}`}
              title={`${u.name} ${u.isHost ? "(Host)" : ""}`}
            >
              {u.name.charAt(0).toUpperCase()}
              {u.isHost && <span className="chatSidebar__crown">👑</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Message Feed */}
      <div className="chatSidebar__feed">
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="chatSidebar__systemMsg">
                {msg.text}
              </div>
            );
          }

          const isMe = msg.user === currentUserName;
          return (
            <div
              key={msg.id}
              className={`chatSidebar__msgRow ${isMe ? "meRow" : "otherRow"}`}
            >
              <div className="chatSidebar__msgMeta">
                <span className="chatSidebar__msgAuthor">{isMe ? "You" : msg.user}</span>
                <span className="chatSidebar__msgTime">{msg.time}</span>
              </div>
              <div className={`chatSidebar__msgBubble ${isMe ? "meBubble" : "otherBubble"}`}>
                {msg.message}
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="chatSidebar__typing">
            <span className="chatSidebar__typingDot" />
            <span className="chatSidebar__typingDot" />
            <span className="chatSidebar__typingDot" />
            <span>
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form className="chatSidebar__inputBar" onSubmit={handleSend}>
        <input
          type="text"
          className="chatSidebar__input"
          placeholder="Say something to the room..."
          value={inputText}
          onChange={handleInputChange}
        />
        <button
          type="submit"
          className="chatSidebar__sendBtn"
          disabled={!inputText.trim()}
          aria-label="Send message"
        >
          <SendIcon style={{ fontSize: "1rem" }} />
        </button>
      </form>
    </div>
  );
};

export default ChatSidebar;
