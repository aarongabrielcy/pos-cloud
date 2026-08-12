/**
 * `<id>.<secret>` join/split shared by the enrollment code and the permanent credential - same
 * convention as AdminSession's own refresh-cookie value (`<sessionId>.<secret>`), chosen so the
 * server can do an O(1) indexed lookup by `id` instead of scanning hashes.
 */
export function formatOpaqueToken(id: string, secret: string): string {
  return `${id}.${secret}`;
}

export function parseOpaqueToken(raw: string): { id: string; secret: string } | null {
  const separatorIndex = raw.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return null;
  }
  return { id: raw.slice(0, separatorIndex), secret: raw.slice(separatorIndex + 1) };
}
