// OcrDebugModal.jsx — shows raw OCR text so we can diagnose extraction failures
export default function OcrDebugModal({ rawTexts, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">🔍 Raw OCR Text</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          This is what Tesseract OCR extracted from your PDFs.
          Check if question numbers like <strong>1(a)</strong>, <strong>(b)</strong>, <strong>OR</strong> appear correctly.
          Share this with support if questions aren't being detected.
        </p>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rawTexts.map((rt, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--primary)' }}>
                📄 {rt.file}
              </div>
              <textarea
                readOnly
                value={rt.text}
                style={{
                  width: '100%', height: 280, resize: 'vertical',
                  fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: 10, background: '#F8FAFC', color: '#1E293B',
                  boxSizing: 'border-box',
                }}
              />
              <button
                style={{ marginTop: 4, fontSize: 12 }}
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard.writeText(rt.text)}
              >
                📋 Copy
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
