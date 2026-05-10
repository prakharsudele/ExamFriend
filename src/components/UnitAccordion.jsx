// UnitAccordion.jsx
import { useState } from 'react';
import { exportSingleUnitPDF } from '../utils/pdfExporter';

export default function UnitAccordion({ unit, subject }) {
  const [open, setOpen] = useState(true);

  const partOrder = ['a', 'b', 'c', 'd', 'e'];

  // Separate main (a,b,c,d) from OR option (e)
  const mainQuestions = unit.questions.filter(q => !q.isOrOption);
  const orQuestions = unit.questions.filter(q => q.isOrOption);

  const handleExport = (e) => {
    e.stopPropagation();
    exportSingleUnitPDF(unit, subject);
  };

  return (
    <div className="unit-accordion">
      {/* Header */}
      <div
        className="unit-header"
        id={`unit-${unit.unitNumber}-header`}
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`unit-${unit.unitNumber}-body`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o); }}
      >
        <div className="unit-badge">U{unit.unitNumber}</div>
        <div className="unit-info">
          <div className="unit-name">Unit {unit.unitNumber} — {unit.coLabel}</div>
          <div className="unit-count">
            {unit.questions.length} unique question{unit.questions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="unit-actions" onClick={e => e.stopPropagation()}>
          <button
            id={`export-unit-${unit.unitNumber}`}
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            title={`Download Unit ${unit.unitNumber} PDF`}
          >
            ⬇ PDF
          </button>
        </div>
        <svg
          className={`chevron ${open ? 'open' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="5 8 10 13 15 8" />
        </svg>
      </div>

      {/* Body */}
      <div
        id={`unit-${unit.unitNumber}-body`}
        className={`unit-body ${open ? 'open' : ''}`}
        aria-hidden={!open}
      >
        <table className="questions-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Part</th>
              <th>Question</th>
              <th style={{ width: 70, textAlign: 'center' }}>Marks</th>
              <th style={{ width: 80, textAlign: 'center' }}>Asked</th>
            </tr>
          </thead>
          <tbody>
            {unit.questions.map((q, idx) => {
              // Insert OR divider before isOrOption questions
              const showOrDivider = q.isOrOption &&
                idx > 0 &&
                !unit.questions[idx - 1].isOrOption;

              return (
                <>
                  {showOrDivider && (
                    <tr key={`or-${idx}`}>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <div className="or-divider">
                          <span className="or-text">OR</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <QuestionRow key={`${unit.unitNumber}-${q.part}-${idx}`} q={q} />
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionRow({ q }) {
  const partLabel = q.part ? q.part.toUpperCase() : '?';
  const isHighFreq = q.frequency >= 3;

  return (
    <tr className="question-row">
      {/* Part label */}
      <td>
        <div className="q-part">
          <div
            className="part-label"
            style={q.isOrOption ? {
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            } : {}}
          >
            {partLabel}
          </div>
        </div>
      </td>

      {/* Question text — joined with " / " for variants */}
      <td className="q-text">
        {q.texts.map((text, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="slash-separator"> / </span>
            )}
            <span className={i > 0 ? 'variant' : ''}>{text}</span>
          </span>
        ))}
      </td>

      {/* Marks */}
      <td className="q-marks">
        {q.marks ? (
          <span className="marks-badge">{q.marks}M</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        )}
      </td>

      {/* Frequency dots */}
      <td className="q-freq">
        <div className="freq-dots">
          {[1, 2, 3, 4, 5].map(dot => (
            <div
              key={dot}
              className={`freq-dot ${dot <= (q.frequency || 1) ? 'active' : ''}`}
              title={`Asked ${q.frequency || 1} time(s)`}
              style={dot <= (q.frequency || 1) && isHighFreq ? { background: 'var(--warning)' } : {}}
            />
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' }}>
          ×{q.frequency || 1}
        </div>
      </td>
    </tr>
  );
}
