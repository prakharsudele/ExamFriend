/**
 * deduplicator.js
 * Merges questions from multiple parsed papers into a unit-wise question bank.
 * Uses TF-IDF cosine similarity to group near-duplicate questions.
 */
import { buildCorpusSimilarity } from './tfidf.js';

const SIMILARITY_THRESHOLD = 0.52; // above this → considered the same question

/**
 * Merge all parsed papers into a deduplicated unit-wise bank.
 *
 * @param {Array} papers — each from extractQuestionsFromText():
 *   { subject, units: [{ unitNumber, coLabel, questions: [{part, text, marks, isOrOption}] }] }
 *
 * @returns {Array} units — sorted array of:
 *   { unitNumber, coLabel, questions: [{part, texts: string[], marks, isOrOption, frequency}] }
 */
export function mergeAndDeduplicate(papers) {
  // ── Step 1: Collect all questions per unit per part ──────────────────────
  // Structure: unitMap[unitNum][part] = [ { text, marks, isOrOption, paperIndex } ]
  const unitMeta = {};   // unitNum → { coLabel }
  const unitPartBuckets = {}; // unitNum → part → Question[]

  for (let pi = 0; pi < papers.length; pi++) {
    const paper = papers[pi];
    for (const unit of paper.units) {
      const u = unit.unitNumber;
      if (!unitMeta[u]) unitMeta[u] = { coLabel: unit.coLabel };
      if (!unitPartBuckets[u]) unitPartBuckets[u] = {};

      for (const q of unit.questions) {
        const p = q.part;
        if (!unitPartBuckets[u][p]) unitPartBuckets[u][p] = [];
        unitPartBuckets[u][p].push({ text: q.text, marks: q.marks, isOrOption: q.isOrOption });
      }
    }
  }

  // ── Step 2: Deduplicate within each (unit, part) bucket using TF-IDF ────
  const partOrder = ['a', 'b', 'c', 'd', 'e'];

  const mergedUnits = Object.keys(unitMeta)
    .map(Number)
    .sort((a, b) => a - b)
    .map(unitNum => {
      const buckets = unitPartBuckets[unitNum] || {};
      const parts = Object.keys(buckets).sort(
        (x, y) => partOrder.indexOf(x) - partOrder.indexOf(y)
      );

      const questions = [];

      for (const part of parts) {
        const rawQs = buckets[part];
        if (!rawQs || rawQs.length === 0) continue;

        // Build corpus similarity for this part's questions
        const texts = rawQs.map(q => q.text);
        const sim = texts.length > 1 ? buildCorpusSimilarity(texts) : null;

        // Greedy grouping: each question joins the first group it's similar to
        const groups = []; // [ { texts: [], marks, isOrOption, frequency } ]

        for (let i = 0; i < rawQs.length; i++) {
          const q = rawQs[i];
          let matched = false;

          for (const group of groups) {
            // Compare against the canonical (first) text of the group
            const canonIndex = texts.indexOf(group.texts[0]);
            const score = sim ? sim(canonIndex, i) : 0;

            if (score >= SIMILARITY_THRESHOLD) {
              // Check it's not already in the group (exact match)
              const alreadyIn = group.texts.some(t =>
                sim ? sim(texts.indexOf(t), i) >= 0.88 : t === q.text
              );
              if (!alreadyIn) group.texts.push(q.text);
              group.frequency = (group.frequency || 1) + 1;
              matched = true;
              break;
            }
          }

          if (!matched) {
            groups.push({
              part,
              texts: [q.text],
              marks: q.marks,
              isOrOption: q.isOrOption,
              frequency: 1,
            });
          }
        }

        questions.push(...groups);
      }

      return {
        unitNumber: unitNum,
        coLabel: unitMeta[unitNum].coLabel,
        questions,
      };
    })
    .filter(u => u.questions.length > 0);

  return mergedUnits;
}
