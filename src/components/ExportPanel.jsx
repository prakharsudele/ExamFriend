// ExportPanel.jsx
import { exportAllUnitsPDF } from '../utils/pdfExporter';

export default function ExportPanel({ units, subject }) {
  const totalQ = units.reduce((s, u) => s + u.questions.length, 0);

  const handleExportAll = () => {
    exportAllUnitsPDF(units, subject, `ExamFriend_${subject.replace(/\s+/g, '_')}_AllUnits.pdf`);
  };

  return (
    <section className="export-section" id="export-section">
      <div className="export-card">
        <div style={{ fontSize: 36, marginBottom: 12 }}>📥</div>
        <div className="export-title">Ready to Download</div>
        <p className="export-sub">
          {totalQ} unique questions across {units.length} units — export as a clean revision PDF
        </p>
        <div className="export-buttons">
          <button
            id="export-all-btn"
            className="btn btn-primary btn-lg"
            onClick={handleExportAll}
          >
            ⬇ Download All Units PDF
          </button>
        </div>
        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          Or use the <strong>⬇ PDF</strong> button on each unit to download individually
        </p>
      </div>
    </section>
  );
}
