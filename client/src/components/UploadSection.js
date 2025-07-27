import React from 'react';
import './UploadSection.css';

function UploadSection({ file, onFileChange, onUpload, loading, uploadMessage }) {
  return (
    <div className="upload-section">
      <h2>1. Upload Document</h2>
      <div className="file-input-container">
        <input
          type="file"
          id="document-upload"
          accept=".pdf"
          onChange={onFileChange}
          disabled={loading}
        />
        <label htmlFor="document-upload" className="file-input-label">
          {file ? file.name : 'Choose PDF file...'}
        </label>
        <button onClick={onUpload} disabled={!file || loading} className="upload-button">
          {loading ? <><span className="spinner" /> Uploading...</> : 'Upload'}
        </button>
      </div>
      {uploadMessage && (
        <div className={`message ${uploadMessage.includes('Processed') ? 'success' : 'error'}`}>
          {uploadMessage}
        </div>
      )}
    </div>
  );
}

export default UploadSection;
