import type { DesignSystem } from "./db.js";

/**
 * Find the best-matching published system for a given name query.
 * Priority: exact → case-insensitive → starts-with → partial word → first word.
 * Returns null if nothing matches, or "ambiguous" if multiple are tied.
 */
export function matchSystem(
  query: string,
  systems: DesignSystem[]
): DesignSystem | null | "ambiguous" {
  if (!systems.length) return null;

  const q = query.trim().toLowerCase();
  if (!q) return null;

  // 1. Exact match
  const exact = systems.filter((s) => s.name.toLowerCase() === q);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return "ambiguous";

  // 2. Case-insensitive contains
  const contains = systems.filter((s) => s.name.toLowerCase().includes(q));
  if (contains.length === 1) return contains[0]!;
  if (contains.length > 1) {
    // Prefer starts-with among the matches
    const starts = contains.filter((s) => s.name.toLowerCase().startsWith(q));
    if (starts.length === 1) return starts[0]!;
    return "ambiguous";
  }

  // 3. Query contains the system name (e.g. query="moontech ds design system")
  const reversed = systems.filter((s) => q.includes(s.name.toLowerCase()));
  if (reversed.length === 1) return reversed[0]!;
  if (reversed.length > 1) {
    // Return longest match (most specific)
    reversed.sort((a, b) => b.name.length - a.name.length);
    return reversed[0]!;
  }

  // 4. First word of query matches first word of system name
  const queryFirstWord = q.split(/\s+/)[0]!;
  const firstWord = systems.filter((s) => {
    const sFirst = s.name.toLowerCase().split(/\s+/)[0]!;
    return sFirst === queryFirstWord;
  });
  if (firstWord.length === 1) return firstWord[0]!;

  return null;
}
