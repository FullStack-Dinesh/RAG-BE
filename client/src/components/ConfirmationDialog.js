import React from 'react';
import './ConfirmationDialog.css';


function ConfirmationDialog({ onConfirm, onCancel }) {
  return (
    <div className="confirmation-dialog-overlay">
      <div className="confirmation-dialog">
        <p>This will remove all uploaded documents and chat history. Continue?</p>
        <div className="dialog-buttons">
          <button onClick={onConfirm} className="confirm-button">Yes, Start Over</button>
          <button onClick={onCancel} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
