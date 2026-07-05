// Only http(s) URLs are safe to render into an href. Blocks javascript:/data:
// and other schemes that would execute in the clicking user's session — a
// belt-and-braces guard alongside the server-side scheme validation, and cover
// for any values persisted before that validation existed.
export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}
