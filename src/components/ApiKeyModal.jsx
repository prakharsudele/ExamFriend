// ApiKeyModal.jsx
import { useState } from 'react';

export default function ApiKeyModal({ onSave, onClose, existingKey }) {
  const [key, setKey] = useState(existingKey || '');
  const [show, setShow] = useState(false);

  const handleSave = () => {
    if (!key.trim()) return;
    onSave(key.trim());
  };

  return (
    <div
      className="modal-backdrop"
      id="api-key-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Gemini API Key Setup"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box">
        <div className="modal-icon">🔑</div>
        <h2 className="modal-title">Set Gemini API Key</h2>
        <p className="modal-desc">
          ExamFriend uses Google Gemini Vision to read your exam papers.
          Your key is stored only in your browser and never sent to any server other than Google.
        </p>
        <div className="modal-input-wrap">
          <input
            id="gemini-api-key-input"
            className="modal-input"
            type={show ? 'text' : 'password'}
            placeholder="AIza..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
            spellCheck={false}
          />
          <button
            className="input-eye"
            onClick={() => setShow(s => !s)}
            title={show ? 'Hide key' : 'Show key'}
            aria-label={show ? 'Hide API key' : 'Show API key'}
          >
            {show ? '🙈' : '👁️'}
          </button>
        </div>
        <div style={{
          background: '#FFFBEB', border: '1.5px solid #FCD34D',
          borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          fontSize: 13, lineHeight: 1.6,
        }}>
          <strong>⚠️ Important:</strong> Your key <em>must</em> come from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', fontWeight: 600 }}
          >
            Google AI Studio ↗
          </a>
          , <strong>not</strong> from Google Cloud Console.
          AI Studio keys are <strong>100% free</strong> — no billing, no credit card.
          Cloud Console keys have zero free quota and will always fail.
        </div>
        <p className="modal-hint" style={{ marginBottom: 20 }}>
          Steps: Go to{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            aistudio.google.com/app/apikey
          </a>{' '}
          → click <strong>"Create API key"</strong> → copy and paste it here.
        </p>
        <div className="modal-actions">
          <button id="api-key-cancel" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            id="api-key-save"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!key.trim()}
          >
            ✅ Save Key
          </button>
        </div>
      </div>
    </div>
  );
}
