// App.jsx — v2: fully local, no Gemini, no API key
import { useState, useCallback } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import UnitAccordion from './components/UnitAccordion';
import ExportPanel from './components/ExportPanel';
import OcrDebugModal from './components/OcrDebugModal';
import { ToastContainer, createToast } from './components/Toast';
import { useProcessor } from './hooks/useProcessor';

let paperId = 0;

export default function App() {
  const [papers, setPapers] = useState([]);
  const [mergedUnits, setMergedUnits] = useState(null);
  const [subject, setSubject] = useState('Exam Questions');
  const [toasts, setToasts] = useState([]);
  const [rawTexts, setRawTexts] = useState([]);
  const [showDebug, setShowDebug] = useState(false);

  const { processFiles, isProcessing, progress } = useProcessor();

  // ── Toast helpers ────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 4500) => {
    setToasts(prev => [...prev, createToast(message, type, duration)]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Upload handling ──────────────────────────────────────────────────────
  const handleAddFiles = useCallback((files) => {
    // Filter: PDF only
    const pdfs = files.filter(f => f.type === 'application/pdf');
    const skipped = files.length - pdfs.length;
    if (skipped > 0) addToast(`${skipped} non-PDF file(s) skipped`, 'info');
    if (pdfs.length === 0) return;

    const newPapers = pdfs.map(file => ({ id: ++paperId, file, status: 'pending' }));
    setPapers(prev => [...prev, ...newPapers]);
    addToast(`${pdfs.length} PDF${pdfs.length > 1 ? 's' : ''} added`, 'success');
  }, [addToast]);

  const handleRemovePaper = useCallback((id) => {
    setPapers(prev => prev.filter(p => p.id !== id));
    setMergedUnits(null);
  }, []);

  // ── Process ──────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (papers.length === 0) {
      addToast('Upload at least one PDF first.', 'info');
      return;
    }

    // Mark all as processing
    setPapers(prev => prev.map(p => ({ ...p, status: 'processing' })));
    setMergedUnits(null);

    try {
      const files = papers.map(p => p.file);
      const { mergedUnits: units, subject: subj, errors, rawTexts: rt } = await processFiles(files);
      setRawTexts(rt || []);

      // Update statuses
      const errorFiles = new Set(errors.map(e => e.file));
      setPapers(prev => prev.map(p => ({
        ...p,
        status: errorFiles.has(p.file.name) ? 'error' : 'done',
      })));

      if (errors.length > 0) {
        errors.forEach(e => addToast(`⚠️ ${e.file}: ${e.error}`, 'error', 8000));
      }

      const totalQ = units.reduce((s, u) => s + u.questions.length, 0);

      if (totalQ === 0) {
        addToast(
          '⚠️ No questions found after OCR. Click "View OCR Text" below to see what was extracted.',
          'error', 10000
        );
        setShowDebug(true);
        return;
      }

      setMergedUnits(units);
      setSubject(subj || 'Exam Questions');

      const repeated = units.flatMap(u => u.questions).filter(q => q.frequency > 1).length;
      addToast(
        `✅ Found ${totalQ} unique questions across ${papers.length} paper${papers.length > 1 ? 's' : ''}${repeated > 0 ? ` · 🔥 ${repeated} repeated` : ''}`,
        'success',
        5000
      );

      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 200);

    } catch (err) {
      setPapers(prev => prev.map(p => ({ ...p, status: 'error' })));
      addToast(`Processing failed: ${err.message}`, 'error', 7000);
    }
  };

  const totalQ = mergedUnits ? mergedUnits.reduce((s, u) => s + u.questions.length, 0) : 0;
  const highFreqQ = mergedUnits
    ? mergedUnits.flatMap(u => u.questions).filter(q => q.frequency >= 2).length
    : 0;

  return (
    <>
      <Header />

      <main className="app-wrapper">
        {/* Hero */}
        <section className="page-hero">
          <div className="hero-badge">⚡ 100% Local — No API Key, No Internet Required</div>
          <h1 className="hero-title">
            Your Smart<br /><span>Exam Question Bank</span>
          </h1>
          <p className="hero-subtitle">
            Upload your past exam PDFs and instantly get a clean, deduplicated
            list of questions organised by unit — ready to download as PDF.
            Everything runs in your browser.
          </p>
        </section>

        {/* Upload */}
        <UploadZone papers={papers} onAdd={handleAddFiles} onRemove={handleRemovePaper} />

        {/* Process button */}
        {papers.length > 0 && (
          <div className="process-section">
            {isProcessing ? (
              <div style={{ textAlign: 'center', width: '100%', maxWidth: 500, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="spinner dark" />
                  <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                    {progress.label || 'Processing…'}
                  </span>
                </div>
                <div className="progress-bar-wrap">
                  <div
                    className={`progress-bar-fill ${progress.total === 0 ? 'indeterminate' : ''}`}
                    style={{
                      width: progress.total > 0
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : undefined,
                    }}
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  {progress.total > 0 ? `${progress.current} / ${progress.total} steps` : ''}
                </div>
              </div>
            ) : (
              <>
                <button
                  id="extract-btn"
                  className="btn btn-primary btn-lg"
                  onClick={handleProcess}
                >
                  <span>🔍</span>
                  Extract &amp; Organise Questions
                </button>
                <span className="process-hint">
                  {papers.length} PDF{papers.length !== 1 ? 's' : ''} ready · runs locally
                </span>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {papers.length === 0 && !mergedUnits && (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <div className="empty-icon">📋</div>
            <div className="empty-title">No papers uploaded yet</div>
            <div className="empty-sub">Upload your exam PDFs above to get started</div>
          </div>
        )}

        {/* Results */}
        {mergedUnits && (
          <section id="results-section" style={{ marginTop: 40 }}>
            <div className="results-header">
              <h2 className="results-title">📚 Question Bank</h2>
              <div className="results-stats">
                <span className="stat-chip">📝 {totalQ} unique questions</span>
                <span className="stat-chip">📄 {papers.filter(p => p.status === 'done').length} papers</span>
                {highFreqQ > 0 && (
                  <span className="stat-chip" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', borderColor: '#FCD34D' }}>
                    🔥 {highFreqQ} repeated
                  </span>
                )}
              </div>
            </div>

            <div className="unit-list">
              {mergedUnits.map(unit => (
                <UnitAccordion key={unit.unitNumber} unit={unit} subject={subject} />
              ))}
            </div>

            <ExportPanel units={mergedUnits} subject={subject} />
          </section>
        )}
      </main>

      {/* Debug modal — shown when OCR text couldn't be parsed into questions */}
      {showDebug && rawTexts.length > 0 && (
        <OcrDebugModal rawTexts={rawTexts} onClose={() => setShowDebug(false)} />
      )}

      {/* View OCR Text button — shown after failed extraction */}
      {!isProcessing && rawTexts.length > 0 && !mergedUnits && (
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowDebug(true)}
            style={{ fontSize: 13 }}
          >
            🔍 View Raw OCR Text (for debugging)
          </button>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
