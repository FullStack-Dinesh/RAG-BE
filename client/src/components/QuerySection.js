import React from 'react';
import './QuerySection.css';

function QuerySection({ query, onQueryChange, onAsk, onReset, loading }) {
  return (
    <div className="query-section">
      <h2>2. Ask a Question</h2>
      <textarea
        placeholder="Type your question about the document..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        disabled={loading}
      />
      <div className="action-buttons">
        <button onClick={onAsk} disabled={!query.trim() || loading} className="ask-button">
          {loading ? <><span className="spinner" /> Processing...</> : 'Ask Question'}
        </button>
        <button onClick={onReset} className="reset-button">Start Over</button>
      </div>
    </div>
  );
}

export default QuerySection;
