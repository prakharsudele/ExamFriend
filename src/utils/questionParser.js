/**
 * questionParser.js
 * Parses the raw JSON returned by Gemini into a normalized unit-question structure.
 * Designed to be lenient — Gemini's output varies, so we try multiple field names.
 */

export function parseGeminiOutput(rawJson) {
  try {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

    // Handle array at top level: [{units:[...]}, ...]
    const root = Array.isArray(data) ? data[0] : data;
    if (!root) throw new Error('Empty JSON');

    // Find units array — try common field names Gemini uses
    const unitsRaw =
      root.units ||
      root.questions ||
      root.sections ||
      root.data?.units ||
      null;

    if (!unitsRaw || !Array.isArray(unitsRaw)) {
      // Last resort: if root itself is an array and has unitNumber fields
      if (Array.isArray(root) && root[0]?.unitNumber != null) {
        return buildResult(root, root);
      }
      throw new Error(`No units array found. Keys present: ${Object.keys(root).join(', ')}`);
    }

    return buildResult(root, unitsRaw);
  } catch (err) {
    console.error('[ExamFriend] parseGeminiOutput failed:', err.message);
    return null;
  }
}

function buildResult(root, unitsRaw) {
  return {
    subject: root.subject || root.subjectName || root.name || 'Unknown Subject',
    units: unitsRaw
      .map((unit) => {
        // Find questions array — try multiple field names
        const questionsRaw =
          unit.questions ||
          unit.questionList ||
          unit.items ||
          unit.parts ||
          [];

        return {
          unitNumber:
            unit.unitNumber ??
            unit.unit ??
            unit.number ??
            unit.questionNumber ??
            0,
          coLabel:
            unit.coLabel ||
            unit.co ||
            unit.courseOutcome ||
            `CO${unit.unitNumber ?? unit.unit ?? '?'}`,
          questions: questionsRaw
            .map((q) => ({
              part: (q.part || q.subpart || q.label || '').toLowerCase().replace(/[^a-e]/g, ''),
              text: (q.text || q.question || q.content || q.description || '').trim(),
              marks: q.marks ?? q.mark ?? q.weightage ?? null,
              isOrOption:
                q.isOrOption ??
                q.isOr ??
                q.alternateOption ??
                q.orOption ??
                false,
            }))
            .filter((q) => q.text.length > 3), // skip empty/junk
        };
      })
      .filter((u) => u.questions.length > 0 || u.unitNumber > 0),
  };
}

/**
 * Extract JSON from Gemini text that may contain:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing explanation text
 * - Multiple JSON objects (we take the largest one)
 */
export function extractJsonFromGeminiText(text) {
  if (!text) return null;

  // Log raw response to help debug issues
  console.log('[ExamFriend] Raw Gemini response (first 800 chars):\n', text.slice(0, 800));

  // 1. Strip markdown fences
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 2. Try parsing the whole thing as JSON first
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  // 3. Find all {...} or [...] blocks and try each, largest first
  const candidates = [];
  let depth = 0;
  let start = -1;
  let startChar = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if ((ch === '{' || ch === '[') && depth === 0) {
      depth = 1;
      start = i;
      startChar = ch;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(cleaned.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // Sort by length descending — most complete JSON first
  candidates.sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  console.error('[ExamFriend] Could not extract any valid JSON from Gemini response.');
  return null;
}

