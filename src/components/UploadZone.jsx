// UploadZone.jsx — v2: PDF only
import { useRef, useState } from 'react';

export default function UploadZone({ papers, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const valid = [...files].filter(f => f.type === 'application/pdf');
    if (valid.length < files.length) {
      // Silently filter — caller can toast if needed
    }
    if (valid.length > 0) onAdd(valid);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="upload-section">
      {/* Drop Zone */}
      <div
        id="upload-zone"
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        role="button"
        tabIndex={0}
        aria-label="Upload exam papers"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="upload-icon">📄</div>
        <div className="upload-title">
          {dragOver ? 'Drop PDFs here!' : 'Upload Exam Papers'}
        </div>
        <p className="upload-sub">
          Drag &amp; drop or click to browse — text is extracted locally, nothing is uploaded to any server
        </p>
        <div className="upload-formats">
          <span className="format-badge">PDF only</span>
          <span className="format-badge" style={{ background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid #A7F3D0' }}>
            🔒 100% local
          </span>
        </div>
      </div>

      {/* Papers list */}
      {papers.length > 0 && (
        <div className="papers-grid" style={{ marginTop: 20 }}>
          {papers.map((paper) => (
            <div key={paper.id} className="paper-card">
              <div className="paper-icon">📄</div>
              <div className="paper-info">
                <div className="paper-name">{paper.file.name}</div>
                <div className="paper-meta">{formatSize(paper.file.size)}</div>
                <span className={`paper-status ${paper.status}`}>
                  {paper.status === 'pending' && '⏳ Ready'}
                  {paper.status === 'processing' && (
                    <>
                      <span className="spinner dark" style={{ width: 10, height: 10, borderWidth: 2 }} />
                      Processing…
                    </>
                  )}
                  {paper.status === 'done' && '✅ Done'}
                  {paper.status === 'error' && '❌ Error'}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={(e) => { e.stopPropagation(); onRemove(paper.id); }}
                aria-label={`Remove ${paper.file.name}`}
                style={{ padding: '6px', fontSize: 16, flexShrink: 0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
