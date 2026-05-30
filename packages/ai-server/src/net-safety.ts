/**
 * SSRF guards shared by every outbound fetch that targets a URL we do not
 * fully control (RSS feeds, scraped pages, news APIs, vault/ingest sources).
 *
 * `isSafeHttpUrl` rejects non-http(s), loopback, link-local, RFC1918, CGNAT,
 * cloud-metadata (169.254.169.254), IPv6 loopback/ULA/link-local, and
 * decimal/hex-encoded IPv4. `safeFetch` follows redirects MANUALLY and
 * re-validates every hop, so a public URL cannot 30x-redirect into the
 * internal network or the metadata endpoint.
 */
import { isIP } from "node:net";

function ipv4ToOctets(host: string): number[] | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
  }
  // Single-number IPv4 encodings: decimal (2130706433) or hex (0x7f000001).
  let n: number | null = null;
  if (/^\d+$/.test(host)) n = Number(host);
  else if (/^0x[0-9a-f]+$/i.test(host)) n = Number.parseInt(host, 16);
  if (n !== null && Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  return null;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;              // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;    // CGNAT
  return false;
}

function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;

  if (isIP(h) === 6) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true; // link-local / ULA
    if (h.startsWith("::ffff:")) {
      const mapped = ipv4ToOctets(h.slice("::ffff:".length));
      if (mapped && isPrivateIpv4(mapped)) return true;
    }
    return false;
  }

  const octets = ipv4ToOctets(h);
  return octets ? isPrivateIpv4(octets) : false;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return !isPrivateOrReservedHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Fetch with manual redirect handling: every hop (including the initial URL and
 * each Location) is re-validated with isSafeHttpUrl. Returns null if any hop is
 * unsafe or the redirect limit is exceeded. Caller passes its own headers/signal.
 */
export async function safeFetch(
  initialUrl: string,
  init: RequestInit = {},
  maxRedirects = 4,
): Promise<Response | null> {
  let current = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!isSafeHttpUrl(current)) return null;
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return null;
}
