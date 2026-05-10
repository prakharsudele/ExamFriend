/**
 * tfidf.js
 * Lightweight TF-IDF + cosine similarity, runs entirely in the browser.
 * Used to detect near-duplicate exam questions across multiple papers.
 */

// ── Stop words ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'that','this','these','those','it','its','they','them','their','there',
  'what','which','who','how','when','where','why','all','any','each',
  'also','both','either','neither','given','using','use','find','write',
  'define','explain','describe','discuss','list','state','prove','show',
  'solve','calculate','compute','determine','evaluate','compare',
]);

/**
 * Tokenise a question string into meaningful words.
 */
function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Build IDF (Inverse Document Frequency) from a list of documents (token arrays).
 * Returns a Map: token → idf score
 */
function buildIDF(tokenised) {
  const N = tokenised.length;
  const df = new Map(); // token → document count

  for (const tokens of tokenised) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }

  const idf = new Map();
  for (const [token, count] of df) {
    idf.set(token, Math.log((N + 1) / (count + 1)) + 1); // smoothed IDF
  }
  return idf;
}

/**
 * Compute TF-IDF vector for a document (token array) given an IDF map.
 * Returns a Map: token → tf-idf score
 */
function tfidfVector(tokens, idf) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

  const vec = new Map();
  for (const [t, count] of tf) {
    const idfScore = idf.get(t) || 0;
    vec.set(t, (count / tokens.length) * idfScore);
  }
  return vec;
}

/**
 * Cosine similarity between two TF-IDF vectors.
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [t, a] of vecA) {
    const b = vecB.get(t) || 0;
    dot += a * b;
    normA += a * a;
  }
  for (const [, b] of vecB) normB += b * b;

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main export: compute similarity between two question text strings.
 * Returns 0–1 where 1 = identical.
 */
export function textSimilarity(textA, textB) {
  const tokA = tokenise(textA);
  const tokB = tokenise(textB);
  if (tokA.length === 0 && tokB.length === 0) return 1;
  if (tokA.length === 0 || tokB.length === 0) return 0;

  const idf = buildIDF([tokA, tokB]);
  const vecA = tfidfVector(tokA, idf);
  const vecB = tfidfVector(tokB, idf);
  return cosineSimilarity(vecA, vecB);
}

/**
 * Batch similarity: given a corpus of texts, build a shared IDF for better scoring.
 * Returns a function: (indexA, indexB) → similarity score
 */
export function buildCorpusSimilarity(texts) {
  const tokenised = texts.map(tokenise);
  const idf = buildIDF(tokenised);
  const vectors = tokenised.map(t => tfidfVector(t, idf));

  return (i, j) => cosineSimilarity(vectors[i], vectors[j]);
}
