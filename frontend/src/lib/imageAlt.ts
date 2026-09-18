/** Makes repeated gallery alts unique for assistive tech without inventing subjects. */
export function distinctImageAlt(
  alt: string,
  id: string,
  all: { id: string; alt: string }[],
): string {
  const trimmed = alt.trim() || "Photograph at Photo Arena";
  const peers = all.filter((item) => (item.alt.trim() || "Photograph at Photo Arena") === trimmed);
  if (peers.length <= 1) return trimmed;
  const position = peers.findIndex((item) => item.id === id) + 1;
  return `${trimmed} (${position} of ${peers.length})`;
}
