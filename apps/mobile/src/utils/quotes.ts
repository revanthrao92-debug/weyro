type MarkerQuote = {
  id: string;
  totalCost: number | string;
  status?: string;
  provider?: { avgRating?: number | null } | null;
};

/** "Cheapest" / "Best rated" labels by quote id, only when there's more than one quote to compare. */
export function quoteMarkersFor(all: MarkerQuote[]): Record<string, string> {
  const markers: Record<string, string> = {};
  // Only quotes the customer can still accept compete.
  const quotes = all.filter((q) => !q.status || q.status === 'PENDING');
  if (quotes.length < 2) return markers;
  const cheapest = quotes.reduce((a, b) => (Number(b.totalCost) < Number(a.totalCost) ? b : a));
  const rated = quotes.reduce((a, b) => ((b.provider?.avgRating ?? 0) > (a.provider?.avgRating ?? 0) ? b : a));
  markers[cheapest.id] = 'Cheapest';
  if ((rated.provider?.avgRating ?? 0) > 0) {
    markers[rated.id] = rated.id === cheapest.id ? 'Cheapest and best rated' : 'Best rated';
  }
  return markers;
}
