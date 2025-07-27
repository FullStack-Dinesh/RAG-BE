import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import UploadSection from './components/UploadSection';
import QuerySection from './components/QuerySection';
import ChatSection from './components/ChatSection';
import ConfirmationDialog from './components/ConfirmationDialog';

function App() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loading, setLoading] = useState({ upload: false, ask: false });
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleFileChange = (e) => {
  const selectedFile = e.target.files[0];
  console.log('Selected file:', selectedFile);
  setFile(selectedFile);
  setUploadMessage('');
  setAnswer('');
  setUploadedFileName(selectedFile?.name || '');
};

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage('Please select a PDF file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading({ ...loading, upload: true });
      const res = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessage(res.data.message);
      setSessionId(res.data.session_id);
      setMessages([{ text: `Document "${file.name}" uploaded successfully`, sender: 'bot' }]);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage(error.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setLoading({ ...loading, upload: false });
    }
  };

  const handleAsk = async () => {
    if (!query.trim()) {
      setAnswer('Please enter a question');
      return;
    }

    try {
      setLoading({ ...loading, ask: true });
      const res = await axios.post('http://localhost:8000/query', {
        question: query,
        session_id: sessionId
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      setAnswer(res.data.answer);
      setMessages(prev => [...prev, { text: query, sender: 'user' }, { text: res.data.answer, sender: 'bot' }]);
      setQuery('');
    } catch (error) {
      console.error('Query error:', error);
      setAnswer(error.response?.data?.detail || 'Failed to get answer. Please try again.');
    } finally {
      setLoading({ ...loading, ask: false });
    }
  };

  const handleReset = () => setShowResetConfirm(true);

  const confirmReset = async () => {
    try {
      if (sessionId) {
        await axios.post('http://localhost:8000/reset', { session_id: sessionId }, {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      setSessionId(null);
      setMessages([{ text: "Session reset. All uploaded documents and history have been cleared.", sender: 'bot' }]);
      setFile(null);
      setUploadedFileName('');
      setQuery('');
      setAnswer('');
      setUploadMessage('');
    } catch (error) {
      console.error("Reset failed:", error);
      setMessages(prev => [...prev, { text: "Failed to reset session. Please try again.", sender: 'bot' }]);
    } finally {
      setShowResetConfirm(false);
    }
  };

  const cancelReset = () => setShowResetConfirm(false);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Document AI Assistant</h1>
        <p>Ask questions about your uploaded documents</p>
      </header>

      <UploadSection
        file={file}
        onFileChange={handleFileChange}
        onUpload={handleUpload}
        loading={loading.upload}
        uploadMessage={uploadMessage}
      />
      
      <ChatSection messages={messages} />
      
      <QuerySection
        query={query}
        onQueryChange={setQuery}
        onAsk={handleAsk}
        onReset={handleReset}
        loading={loading.ask}
      />

      {showResetConfirm && (
        <ConfirmationDialog
          onConfirm={confirmReset}
          onCancel={cancelReset}
        />
      )}

    </div>
  );
}

export default App;
