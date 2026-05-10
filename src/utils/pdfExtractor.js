/**
 * pdfExtractor.js  — v2 with OCR
 *
 * Pipeline for SCANNED PDF papers:
 *   1. pdf.js renders each page → canvas (high-res image)
 *   2. Tesseract.js OCRs each canvas image → text
 *   3. Returns concatenated text, same shape as before
 *
 * For text-based PDFs the direct text path is tried first (fast).
 * If that yields too little text (<30 chars/page avg), OCR kicks in.
 */
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const SCALE = 2.5;
/** A real exam page has 500+ chars; a watermark-only scanned page has ~50 */
const MIN_CHARS_PER_PAGE = 500;
/** Regex: at least one question-number pattern like 1(a) or (b) */
const HAS_QUESTIONS_RE = /\d\s*[\(\[]\s*[a-e]\s*[\)\]]|\(\s*[b-e]\s*\)/i;

/** Returns true if the direct text looks like real exam content */
function looksLikeExamText(text) {
  return text.length >= MIN_CHARS_PER_PAGE && HAS_QUESTIONS_RE.test(text);
}

/**
 * Render a pdf.js PDFPageProxy to an HTMLCanvasElement.
 */
async function renderPageToCanvas(page) {
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Try to get direct (embedded) text from a pdf.js page.
 * Returns '' if the page contains only images.
 */
async function getDirectText(page) {
  const content = await page.getTextContent();
  const items = content.items.filter(item => item.str && item.str.trim());
  if (!items.length) return '';

  // Sort by position: top→bottom, left→right
  items.sort((a, b) => {
    const dy = b.transform[5] - a.transform[5];
    if (Math.abs(dy) > 3) return dy;
    return a.transform[4] - b.transform[4];
  });

  // Group into lines
  const lines = [];
  let lineItems = [];
  let lastY = null;
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (lastY === null || Math.abs(y - lastY) <= 3) {
      lineItems.push(item.str);
    } else {
      if (lineItems.length) lines.push(lineItems.join(' '));
      lineItems = [item.str];
    }
    lastY = y;
  }
  if (lineItems.length) lines.push(lineItems.join(' '));

  return lines.join('\n');
}

/**
 * Main export.
 *
 * @param {File}     file       — PDF file
 * @param {Function} onProgress — called with (pageNum, totalPages, stage)
 * @returns {Promise<string>}  — full extracted text
 */
export async function extractTextFromPDF(file, onProgress = () => {}) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  onProgress(0, numPages, 'Loading PDF…');

  // ── Pass 1: attempt direct text extraction ──────────────────────────────
  const directTexts = [];
  let totalDirectChars = 0;

  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const text = await getDirectText(page);
    directTexts.push(text);
    totalDirectChars += text.length;
  }

  const combinedDirectText = directTexts.join('\n');
  if (looksLikeExamText(combinedDirectText)) {
    console.log('[ExamFriend] Using direct PDF text (has question patterns + enough content)');
    return combinedDirectText;
  }

  console.log('[ExamFriend] Direct text insufficient or lacks question patterns — switching to OCR');
  console.log('[ExamFriend] Direct text sample:', combinedDirectText.slice(0, 200));
  onProgress(0, numPages, 'Initialising OCR engine…');

  // Create Tesseract worker — language data is auto-downloaded from CDN
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // silence internal Tesseract logs
  });

  // Optimise for printed text (not handwriting)
  await worker.setParameters({
    tessedit_char_whitelist: '',
    preserve_interword_spaces: '1',
  });

  const ocrTexts = [];

  for (let p = 1; p <= numPages; p++) {
    onProgress(p - 1, numPages, `OCR page ${p} of ${numPages}…`);
    const page = await pdf.getPage(p);
    const canvas = await renderPageToCanvas(page);

    const { data } = await worker.recognize(canvas);

    // Clean up the OCR output slightly
    const cleaned = data.text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n');

    console.log(`[ExamFriend] Page ${p} OCR confidence: ${Math.round(data.confidence)}%`);
    console.log(`[ExamFriend] Page ${p} text (first 400):\n`, cleaned.slice(0, 400));

    ocrTexts.push(cleaned);
  }

  await worker.terminate();

  onProgress(numPages, numPages, 'OCR complete');
  return ocrTexts.join('\n\n--- PAGE BREAK ---\n\n');
}
