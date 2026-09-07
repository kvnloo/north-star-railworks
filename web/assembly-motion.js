export const REPLAY_DURATION = 12;
export function separationAt(seconds) {
  const t = Math.max(0, Math.min(REPLAY_DURATION, seconds));
  if (t < 0.75) return 0;
  if (t < 4.75) return 100 * (t-0.75)/4;
  if (t < 7.25) return 100;
  if (t < 11.25) return 100 * (11.25-t)/4;
  return 0;
}
export function replayPhase(seconds) {
  if (seconds < 0.75) return 'Assembled';
  if (seconds < 4.75) return 'Separating';
  if (seconds < 7.25) return 'Exploded hold';
  if (seconds < 11.25) return 'Reassembling';
  return 'Complete';
}
