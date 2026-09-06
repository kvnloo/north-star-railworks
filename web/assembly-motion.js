export const REPLAY_DURATION = 12;
export function separationAt(seconds) {
  const t = Math.max(0, Math.min(REPLAY_DURATION, seconds));
  const smooth = value => value * value * (3 - 2 * value);
  if (t < 1) return 0;
  if (t < 5) return 100 * smooth((t - 1) / 4);
  if (t < 7) return 100;
  if (t < 11) return 100 * (1 - smooth((t - 7) / 4));
  return 0;
}
