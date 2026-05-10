/**
 * useGemini.js
 * Hook for calling the Gemini Vision API to extract structured questions from paper images/PDFs.
 */
import { useState, useCallback } from 'react';
import { parseGeminiOutput, extractJsonFromGeminiText } from '../utils/questionParser';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const EXTRACTION_PROMPT = `You are an expert at reading university exam papers.
Analyze this exam paper image and extract ALL questions from it.

The paper has this structure:
- 5 main questions (Q1 through Q5), each corresponding to a unit (CO1–CO5)
- Each main question has sub-parts: a, b, c (compulsory) and d OR e (internal choice, 10 marks)
- Parts a, b, c have marks as stated on the paper (typically 3, 4, 4)
- Parts d and e are alternatives of each other (OR choice)

Return ONLY a valid JSON object in exactly this format (no markdown, no explanation):
{
  "subject": "<subject name if visible, else Unknown>",
  "units": [
    {
      "unitNumber": 1,
      "coLabel": "CO1",
      "questions": [
        { "part": "a", "text": "<full question text>", "marks": 3, "isOrOption": false },
        { "part": "b", "text": "<full question text>", "marks": 4, "isOrOption": false },
        { "part": "c", "text": "<full question text>", "marks": 4, "isOrOption": false },
        { "part": "d", "text": "<full question text>", "marks": 10, "isOrOption": false },
        { "part": "e", "text": "<full question text>", "marks": 10, "isOrOption": true }
      ]
    },
    ... (repeat for units 2-5)
  ]
}

Rules:
- Include the COMPLETE question text, including any data given (numbers, sequences, etc.)
- If a sub-part is missing from the paper, skip it
- If marks aren't visible, use null
- Preserve mathematical notation as text`;

/** Convert a File to base64 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Sleep helper */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Classify API error type */
function classifyError(msg) {
  const m = msg.toLowerCase();
  if (m.includes('quota') || m.includes('resource_exhausted') || m.includes('free_tier')) return 'QUOTA';
  if (m.includes('api_key_invalid') || m.includes('invalid api key') || m.includes('401')) return 'KEY';
  return 'OTHER';
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useGemini() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });

  const extractQuestions = useCallback(async (files, apiKey) => {
    if (!apiKey) throw new Error('Gemini API key is required');
    if (!files || files.length === 0) throw new Error('No files provided');

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length, label: 'Starting...' });

    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const baseLabel = `${file.name} (${i + 1}/${files.length})`;
      setProgress({ current: i + 1, total: files.length, label: baseLabel });

      const onModelChange = (modelLabel) => {
        setProgress({ current: i + 1, total: files.length, label: `${baseLabel} — trying ${modelLabel}` });
      };

      try {
        const parsed = await extractFromFile(file, apiKey, onModelChange);
        if (parsed) {
          results.push({ file: file.name, ...parsed });
        } else {
          errors.push({ file: file.name, error: 'Could not parse Gemini response — check console (F12)' });
        }
      } catch (err) {
        errors.push({ file: file.name, error: err.message });
      }

      // Pause between files so rate limits don't compound
      if (i < files.length - 1) await sleep(3000);
    }

    setIsProcessing(false);
    setProgress({ current: 0, total: 0, label: '' });
    return { results, errors };
  }, []);

  return { extractQuestions, isProcessing, progress };
}

// ── Core extraction (model waterfall + retry) ─────────────────────────────────

/**
 * Candidate models to try in order.
 * We filter this list at runtime using ListModels to skip any 404s upfront.
 */
const MODEL_CANDIDATES = [
  'gemini-2.0-flash-lite',   // 30 RPM free — best
  'gemini-2.0-flash',        // 15 RPM free
  'gemini-1.5-flash',        // proven stable fallback
  'gemini-1.5-flash-8b',     // smaller variant (may or may not exist)
];

/** Cache of confirmed-available models for this API key session */
let _confirmedModels = null;

/**
 * Call ListModels once per session to find which models this key can actually use.
 * Falls back to the full candidate list if the call fails.
 */
async function getAvailableModels(apiKey) {
  if (_confirmedModels) return _confirmedModels;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
    );
    if (!res.ok) throw new Error('ListModels failed');
    const data = await res.json();
    const names = (data.models || [])
      .map(m => m.name.replace('models/', ''))
      .filter(n => n.startsWith('gemini'));
    // Keep only our candidates that exist in the API response
    const available = MODEL_CANDIDATES.filter(c => names.includes(c));
    console.log('[ExamFriend] Available models for this key:', available);
    _confirmedModels = available.length > 0 ? available : MODEL_CANDIDATES;
  } catch {
    console.log('[ExamFriend] Could not list models, using defaults.');
    _confirmedModels = MODEL_CANDIDATES;
  }
  return _confirmedModels;
}

async function extractFromFile(file, apiKey, onModelChange) {
  const { base64, mimeType } = await fileToBase64(file);

  const requestBody = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.1, topP: 0.8, maxOutputTokens: 8192 },
  };

  const modelList = await getAvailableModels(apiKey);
  let lastError = null;

  for (const model of modelList) {
    if (onModelChange) onModelChange(model);
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    let skipToNextModel = false;

    for (let attempt = 0; attempt < 4; attempt++) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      } catch (netErr) {
        throw new Error(`Network error: ${netErr.message}`);
      }

      // 429 Rate limit OR 503 Service unavailable — both are retryable
      if (response.status === 429 || response.status === 503) {
        const reason = response.status === 429 ? 'Rate limited' : 'Service unavailable';
        if (attempt < 3) {
        const waitSec = attempt === 0 ? 5 : attempt === 1 ? 15 : 60; // 5s → 15s → 60s (quota resets in 60s)
          console.log(`[ExamFriend] ${reason} on ${model} (attempt ${attempt + 1}), waiting ${waitSec}s…`);
          if (onModelChange) onModelChange(`${model} — waiting ${waitSec}s…`);
          await sleep(waitSec * 1000);
          if (onModelChange) onModelChange(model);
          continue; // retry same model
        }
        // All retries exhausted → move to next model
        lastError = response.status === 429
          ? new Error('QUOTA')
          : new Error(`${model} temporarily unavailable`);
        skipToNextModel = true;
        break;
      }

      // Other non-OK responses
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const rawMsg = errData?.error?.message || `HTTP ${response.status}`;
        const kind = classifyError(rawMsg);

        if (response.status === 404 || rawMsg.includes('not found') || rawMsg.includes('not supported') || rawMsg.includes('deprecated')) {
          console.log(`[ExamFriend] ${model} unavailable (${response.status}), trying next model…`);
          lastError = new Error(`${model} not available`);
          skipToNextModel = true;
          break;
        }

        if (kind === 'QUOTA') {
          console.log(`[ExamFriend] Quota hit on ${model}, trying next model…`);
          lastError = new Error('QUOTA');
          skipToNextModel = true;
          break;
        }

        if (kind === 'KEY') {
          throw new Error(
            'Invalid API key. Make sure you are using a key from Google AI Studio (aistudio.google.com/app/apikey) — NOT from Google Cloud Console.'
          );
        }

        throw new Error(`${model}: ${rawMsg}`);
      }

      // ── Success ──────────────────────────────────────────────────────────
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        // Could be safety filter or empty response
        const blockReason = data?.candidates?.[0]?.finishReason;
        throw new Error(
          blockReason === 'SAFETY'
            ? 'Gemini blocked this paper for safety reasons. Try a cleaner scan.'
            : 'Empty response from Gemini. Try a higher-quality scan.'
        );
      }

      const jsonObj = extractJsonFromGeminiText(text);
      if (!jsonObj) {
        throw new Error('Could not extract JSON from Gemini response. Check browser console (F12) for the raw output.');
      }

      const parsed = parseGeminiOutput(jsonObj);
      if (!parsed) {
        throw new Error('Gemini returned unexpected JSON structure. Check browser console (F12) for details.');
      }

      console.log(`[ExamFriend] ✅ Success with ${model}`);
      return parsed;
    }

    if (!skipToNextModel) break;
  }

  // All models tried and failed
  if (lastError?.message === 'QUOTA') {
    throw new Error(
      'Rate limit on all models. Please wait ~1 minute and try again. ' +
      'Make sure your API key is from Google AI Studio (aistudio.google.com/app/apikey), not Google Cloud Console.'
    );
  }

  throw lastError || new Error('All Gemini models failed. Check your API key at aistudio.google.com/app/apikey.');
}
