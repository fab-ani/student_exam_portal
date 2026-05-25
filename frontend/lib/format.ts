export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0s";
  const s = Math.floor(total);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}
