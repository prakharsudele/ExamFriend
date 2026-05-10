/**
 * useProcessor.js
 * Orchestrates the fully local pipeline:
 *   PDF file → pdf.js text → regex extractor → TF-IDF deduplicator → merged units
 *
 * No API key, no network calls, no Gemini.
 */
import { useState, useCallback } from 'react';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import { extractQuestionsFromText } from '../utils/questionExtractor.js';
import { mergeAndDeduplicate } from '../utils/deduplicator.js';

export function useProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });

  /**
   * Process an array of PDF File objects.
   * Returns { mergedUnits, subject, errors }
   */
  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) throw new Error('No files provided');

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length * 2, label: 'Starting…' });

    const parsedPapers = [];
    const errors = [];
    let step = 0;

    // ── Phase 1: Extract text from each PDF ──────────────────────────────
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      step++;
      setProgress({
        current: step,
        total: files.length * 2,
        label: `Reading: ${file.name}`,
      });

      try {
        // onProgress receives (pagesDone, totalPages, stage) from pdfExtractor
        const onOcrProgress = (pagesDone, totalPages, stage) => {
          setProgress({
            current: step,
            total: files.length * 2,
            label: `${file.name} — ${stage}`,
          });
        };

        const rawText = await extractTextFromPDF(file, onOcrProgress);
        parsedPapers.push({ file: file.name, rawText });
      } catch (err) {
        console.error(`[ExamFriend] Text extraction failed for ${file.name}:`, err);
        errors.push({ file: file.name, error: `Could not read PDF: ${err.message}` });
      }
    }

    // ── Phase 2: Parse questions from each extracted text ────────────────
    const questionBanks = [];

    for (const paper of parsedPapers) {
      step++;
      setProgress({
        current: step,
        total: files.length * 2,
        label: `Parsing questions: ${paper.file}`,
      });

      try {
        console.log(`[ExamFriend] Raw text for ${paper.file} (first 600 chars):\n`, paper.rawText.slice(0, 600));
        const parsed = extractQuestionsFromText(paper.rawText);
        console.log(`[ExamFriend] Extracted ${parsed.units.reduce((s, u) => s + u.questions.length, 0)} questions from ${paper.file}`);
        questionBanks.push(parsed);
      } catch (err) {
        console.error(`[ExamFriend] Question parsing failed for ${paper.file}:`, err);
        errors.push({ file: paper.file, error: `Question parsing failed: ${err.message}` });
      }
    }

    // ── Phase 3: Merge + deduplicate ────────────────────────────────────
    let mergedUnits = [];
    let subject = 'Exam Questions';

    if (questionBanks.length > 0) {
      setProgress({ current: files.length * 2, total: files.length * 2, label: 'Grouping similar questions…' });

      try {
        mergedUnits = mergeAndDeduplicate(questionBanks);
        subject = questionBanks[0]?.subject || 'Exam Questions';
      } catch (err) {
        console.error('[ExamFriend] Deduplication failed:', err);
        errors.push({ file: 'merge', error: `Deduplication failed: ${err.message}` });
      }
    }

    setIsProcessing(false);
    setProgress({ current: 0, total: 0, label: '' });

    // Include raw texts for debug modal
    const rawTexts = parsedPapers.map(p => ({ file: p.file, text: p.rawText }));
    return { mergedUnits, subject, errors, rawTexts };
  }, []);

  return { processFiles, isProcessing, progress };
}
