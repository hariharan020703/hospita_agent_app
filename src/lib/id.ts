// Identifier helpers for records created in the browser (mock data source).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const newId = (prefix: string): string => `${prefix}_${randomChars(10, 'abcdefghijkmnpqrstuvwxyz23456789')}`;

/** Booking reference such as MF7K2QXD: easy to read aloud, no 0/O or 1/I. */
export const newBookingRef = (): string => `MF${randomChars(6, ALPHABET)}`;
