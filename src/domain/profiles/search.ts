import { normalise } from "@/lib/search";

/**
 * Search keys for names and topics (FR-PRF-011, AC-PRF-01.3, C-115).
 *
 * `normalise` implements the written folding pairs (ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g, ё/е). The spec's own
 * examples also need "mammadov" to find "Məmmədov" (ə written as a), the known gap OQ-B1-49. We close it
 * here, locally, without changing the shared normaliser: a text is indexed under BOTH readings of ə
 * (as e, and as a), so either spelling of the query matches. The SQL twin is mh_search_key (migration 0050).
 */
export function searchKey(text: string): string {
  const std = normalise(text);
  const alt = normalise(text.replace(/[əƏ]/g, (c) => (c === "ə" ? "a" : "A")));
  return alt === std ? std : `${std} ${alt}`;
}

/** The query side: one folded reading, lower-case, whitespace collapsed. */
export function queryKey(q: string): string {
  return normalise(q).replace(/\s+/g, " ").trim();
}

/** True when every word of the query occurs in the text's key (accent-insensitive, order-free). */
export function matchesSearch(text: string, query: string): boolean {
  const q = queryKey(query);
  if (q === "") return true;
  const key = searchKey(text);
  return q.split(" ").every((w) => key.includes(w));
}

/** Escape LIKE metacharacters so user input is only ever literal text. */
export const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
