/**
 * questionExtractor.js — v3, robust anchor-based parser
 *
 * Finds question anchors (1(a), (b), OR etc.) ANYWHERE in each line,
 * not just at the start — handles OCR table formatting artifacts.
 */

const PART_MARKS = { a: 3, b: 4, c: 4, d: 10, e: 10 };

function cleanText(s) {
  return s.replace(/\s+/g, ' ').replace(/[|]/g, '').trim();
}

function extractSubject(lines) {
  for (const l of lines.slice(0, 25)) {
    const m = l.match(/subject\s*(?:name)?\s*[:\-]\s*(.+)/i);
    if (m) return cleanText(m[1]);
  }
  return 'Unknown Subject';
}

/**
 * Try to find a unit+part anchor in a line.
 * Returns { unitNumber, part, rest } or null.
 * "rest" = the text after the anchor on the same line.
 */
function findNewUnitAnchor(line) {
  // Pattern: optional non-word chars, then digit(s), then letter a-e in parens/brackets/alone
  // Handles: 1(a), 1 (a), 1[a], Q1(a), |1(a)|, l(a) [OCR l→1]
  const patterns = [
    /(?:^|[^\d])([1-5])\s*[\(\[]\s*([a-e])\s*[\)\]]/i,
    /(?:^|[^\d])[lIi1]\s*[\(\[]\s*([a-e])\s*[\)\]]/i, // OCR l→1 for unit 1
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (m) {
      // Extract unit number — handle OCR l/I→1
      const raw = m[1] || '1';
      const unit = /[lIi]/.test(raw) ? 1 : parseInt(raw, 10);
      if (unit < 1 || unit > 5) continue;
      const part = (m[2] || m[1]).toLowerCase();
      const idx = m.index + m[0].length;
      const rest = cleanText(line.slice(idx));
      return { unitNumber: unit, part, rest };
    }
  }
  return null;
}

/**
 * Try to find a continuation part anchor in a line (no unit number).
 * Returns { part, rest } or null.
 */
function findPartAnchor(line) {
  // Patterns: (b), (c), b), [b], b. at start after optional whitespace/pipe
  const m = line.match(/^[|\s]*[\(\[]\s*([b-e])\s*[\)\]]/i)
         || line.match(/^[|\s]*([b-e])\s*[\)\]]/i);
  if (!m) return null;
  const part = m[1].toLowerCase();
  const rest = cleanText(line.slice(m.index + m[0].length));
  return { part, rest };
}

/** Check if line is an OR divider */
function isORLine(line) {
  return /^\s*[|\s\-–—]*\s*OR\s*[|\s\-–—]*\s*$/i.test(line);
}

/** Lines to skip outright */
const SKIP_RE = /^(Q\.?\s*No|Q\.?\s*num|Question|Exam|Time|Max|Subject|Instruction|Attempt|Note|Page|S\.No|---|UIT|RGPV|Autonomous)/i;

// ── Main export ───────────────────────────────────────────────────────────────

export function extractQuestionsFromText(rawText) {
  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const subject = extractSubject(allLines);

  const unitMap = {};
  let currentUnit = null;
  let currentPart = null;
  let currentTexts = [];
  let orSeen = false;

  function flush() {
    if (!currentUnit || !currentPart || !currentTexts.length) return;
    const text = cleanText(currentTexts.join(' '));
    if (text.length < 6) return;
    if (!unitMap[currentUnit]) {
      unitMap[currentUnit] = { unitNumber: currentUnit, coLabel: `CO${currentUnit}`, questions: [] };
    }
    unitMap[currentUnit].questions.push({
      part: currentPart,
      text,
      marks: PART_MARKS[currentPart] ?? null,
      isOrOption: currentPart === 'e' && orSeen,
    });
    currentTexts = [];
  }

  function stripCO(line) {
    const m = line.match(/\bCO[\s\-]?(\d)\s*$/i);
    if (!m) return { line, co: null };
    const co = `CO${m[1]}`;
    if (unitMap[currentUnit]) unitMap[currentUnit].coLabel = co;
    return { line: line.slice(0, line.length - m[0].length).trim(), co };
  }

  for (const raw of allLines) {
    if (SKIP_RE.test(raw)) continue;
    const { line } = stripCO(raw);
    if (!line || line.length < 2) continue;

    // OR divider
    if (isORLine(line)) { orSeen = true; continue; }

    // New unit anchor: e.g. "1(a) For T(n)..."
    const newUnit = findNewUnitAnchor(line);
    if (newUnit) {
      flush();
      currentUnit = newUnit.unitNumber;
      currentPart = newUnit.part;
      if (newUnit.part === 'a') orSeen = false;
      if (newUnit.rest) currentTexts.push(newUnit.rest);
      continue;
    }

    // Continuation part: e.g. "(b) Write down..."
    if (currentUnit !== null) {
      const cont = findPartAnchor(line);
      if (cont) {
        flush();
        currentPart = cont.part;
        if (cont.rest) currentTexts.push(cont.rest);
        continue;
      }
    }

    // Accumulate question text
    if (currentUnit !== null && currentPart !== null) {
      currentTexts.push(line);
    }
  }
  flush();

  return {
    subject,
    units: Object.values(unitMap)
      .filter(u => u.questions.length > 0)
      .sort((a, b) => a.unitNumber - b.unitNumber),
  };
}
