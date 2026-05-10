// Header.jsx — v2: no API key, clean brand
export default function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <a href="/" className="header-logo">
          <div className="logo-icon">📚</div>
          <span className="logo-text">Exam<span>Friend</span></span>
        </a>
        <div className="header-actions">
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--success)',
            background: 'var(--success-soft)',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 12px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            ✅ 100% Local — No API Key Needed
          </span>
        </div>
      </div>
    </header>
  );
}
