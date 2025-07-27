import React from 'react';
import './ChatSection.css'
function ChatSection({ messages }) {
  return (
    <div className="chat-section">
      <h2>Conversation</h2>
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatSection;
