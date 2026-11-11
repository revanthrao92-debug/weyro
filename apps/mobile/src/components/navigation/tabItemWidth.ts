/** Equal width per tab — explicit so labels can never collapse. */
export function tabItemWidth(windowWidth: number, tabCount: number): number {
  return Math.floor(windowWidth / Math.max(tabCount, 1));
}
