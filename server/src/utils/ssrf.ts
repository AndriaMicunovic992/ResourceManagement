// Guard for admin-supplied outbound URLs (the Jira base URL). A tenant admin is
// not an infrastructure-trusted principal, so a URL they set must not be able to
// point the server at loopback / link-local / private / reserved addresses
// (cloud metadata at 169.254.169.254, localhost, internal services, …).
//
// This blocks IP-literal and localhost hosts syntactically. It does NOT resolve
// DNS, so a public hostname that resolves to a private IP is out of scope here;
// full protection would require resolving and re-checking at connect time.

function ipv4Problem(host: string): string | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map((n) => Number(n));
  if (octets.some((n) => n > 255)) return 'is not a valid address';
  const [a, b] = octets;
  if (a === 0) return 'points at a reserved address';
  if (a === 127) return 'points at loopback';
  if (a === 10) return 'points at a private network';
  if (a === 172 && b >= 16 && b <= 31) return 'points at a private network';
  if (a === 192 && b === 168) return 'points at a private network';
  if (a === 169 && b === 254) return 'points at a link-local / metadata address';
  if (a === 100 && b >= 64 && b <= 127) return 'points at a carrier-grade NAT address';
  if (a >= 224) return 'points at a reserved address';
  return null;
}

function ipv6Problem(host: string): string | null {
  // URL hostname keeps IPv6 without brackets.
  if (!host.includes(':')) return null;
  const h = host.toLowerCase();
  if (h === '::1') return 'points at loopback';
  if (h === '::') return 'points at a reserved address';
  if (h.startsWith('fe80')) return 'points at a link-local address';
  if (h.startsWith('fc') || h.startsWith('fd')) return 'points at a unique-local address';
  if (h.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — re-check the embedded v4.
    return ipv4Problem(h.replace('::ffff:', ''));
  }
  return null;
}

/**
 * Returns a human-readable reason the URL is unsafe to fetch server-side, or
 * null when it is acceptable (a public http(s) URL).
 */
export function outboundUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'must be a valid URL';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'must be an http(s) URL';
  }
  // URL.hostname keeps IPv6 literals wrapped in brackets, e.g. "[::1]".
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return 'must include a host';
  if (host === 'localhost' || host.endsWith('.localhost')) return 'must not point at localhost';
  const v4 = ipv4Problem(host);
  if (v4) return `must not use an address that ${v4}`;
  const v6 = ipv6Problem(host);
  if (v6) return `must not use an address that ${v6}`;
  return null;
}
