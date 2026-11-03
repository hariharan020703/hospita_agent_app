/** Only allow same-origin, app-internal return paths (prevents open redirects through ?next=). */
export function safeNext(next: string | null, fallback: string): string {
  if (!next) return fallback;
  const decoded = decodeURIComponent(next);
  return decoded.startsWith('/') && !decoded.startsWith('//') ? decoded : fallback;
}
