/**
 * questionExtractor.js — v4 universal parser
 * Handles:
 * - Q1(a)
 * - Q.1 a
 * - 1(a)
 * - (a)
 * - a)
 * - a.
 * - OCR mistakes
 * - broken spacing
 * - table formatted PDFs
 */

const PART_MARKS = { a: 3, b: 4, c: 4, d: 10, e: 10 };

function cleanText(s) {
  return s
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSubject(lines) {
  for (const l of lines.slice(0, 30)) {
    const m = l.match(/subject\s*(?:code|name)?\s*[:\-]\s*(.+)/i);
    if (m) return cleanText(m[1]);
  }
  return 'Unknown Subject';
}

/**
 * Universal anchor detector
 */
function detectQuestionAnchor(line) {

  const patterns = [

    // Q.1(a)
    /Q\.?\s*([1-5])\s*[\(\[]\s*([a-e])\s*[\)\]]/i,

    // Q.1 a
    /Q\.?\s*([1-5])\s+([a-e])/i,

    // Q1a
    /Q\.?\s*([1-5])([a-e])/i,

    // 1(a)
    /(?:^|[^\d])([1-5])\s*[\(\[]\s*([a-e])\s*[\)\]]/i,

    // 1 a
    /(?:^|[^\d])([1-5])\s+([a-e])/i,

    // OCR Ql(a)
    /Q\.?\s*[lIi1]\s*[\(\[]?\s*([a-e])\s*[\)\]]?/i,

    // (a)
    /^[|\s]*[\(\[]\s*([a-e])\s*[\)\]]/i,

    // a)
    /^[|\s]*([a-e])\s*[\)\]]/i,

    // a.
    /^[|\s]*([a-e])\s*\./i,

    // a Explain
    /^[|\s]*([a-e])\s+/i,

    // aExplain
    /^[|\s]*([a-e])(?=[A-Z])/,
  ];

  for (const re of patterns) {

    const m = line.match(re);

    if (!m) continue;

    let unit = null;
    let part = null;

    // Full unit + part patterns
    if (m.length >= 3 && m[2]) {

      if (/[lIi]/.test(m[1])) {
        unit = 1;
      } else {
        unit = parseInt(m[1], 10);
      }

      part = m[2]?.toLowerCase();

    } else {

      // continuation-only part
      part = m[1]?.toLowerCase();
    }

    if (!part) continue;

    const idx = m.index + m[0].length;

    return {
      unitNumber: unit,
      part,
      rest: cleanText(line.slice(idx)),
    };
  }

  return null;
}

/** Detect OR separator */
function isORLine(line) {
  return /^\s*[|\s\-–—]*OR[|\s\-–—]*$/i.test(line);
}

/** Skip metadata lines */
const SKIP_RE =
  /^(Q\.?\s*No|Question|Exam|Time|Max|Subject|Instruction|Attempt|Note|Page|S\.No|UIT|RGPV|Autonomous)/i;

export function extractQuestionsFromText(rawText) {

  // Normalize OCR garbage
  rawText = rawText
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+\n/g, '\n');

  const allLines = rawText
    .split('\n')
    .map(l => cleanText(l))
    .filter(Boolean);

  const subject = extractSubject(allLines);

  const unitMap = {};

  let currentUnit = null;
  let currentPart = null;
  let currentTexts = [];
  let orSeen = false;

  function flush() {

    if (!currentUnit || !currentPart || !currentTexts.length) {
      currentTexts = [];
      return;
    }

    const text = cleanText(currentTexts.join(' '));

    if (text.length < 6) {
      currentTexts = [];
      return;
    }

    if (!unitMap[currentUnit]) {
      unitMap[currentUnit] = {
        unitNumber: currentUnit,
        coLabel: `CO${currentUnit}`,
        questions: [],
      };
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

    if (!m) return line;

    if (currentUnit && unitMap[currentUnit]) {
      unitMap[currentUnit].coLabel = `CO${m[1]}`;
    }

    return line.slice(0, line.length - m[0].length).trim();
  }

  for (let raw of allLines) {

    if (SKIP_RE.test(raw)) continue;

    raw = stripCO(raw);

    if (!raw || raw.length < 2) continue;

    // OR separator
    if (isORLine(raw)) {
      orSeen = true;
      continue;
    }

    const anchor = detectQuestionAnchor(raw);

    if (anchor) {

      flush();

      if (anchor.unitNumber !== null) {
        currentUnit = anchor.unitNumber;
      }

      currentPart = anchor.part;

      if (currentPart === 'a') {
        orSeen = false;
      }

      if (anchor.rest) {
        currentTexts.push(anchor.rest);
      }

      continue;
    }

    // Continuation text
    if (currentUnit !== null && currentPart !== null) {
      currentTexts.push(raw);
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