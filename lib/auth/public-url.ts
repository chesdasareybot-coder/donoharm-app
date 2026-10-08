import { type NextRequest } from "next/server";

/**
 * Returns the public origin (protocol + host) of the application,
 * ensuring internal container socket addresses (like 0.0.0.0:3000)
 * are never exposed to clients or used in redirect locations.
 */
export function getPublicOrigin(request?: Request | NextRequest): string {
  const forwardedHost = request?.headers?.get("x-forwarded-host");
  const host = forwardedHost || request?.headers?.get("host");
  const proto = request?.headers?.get("x-forwarded-proto") || "https";

  if (host && !host.includes("0.0.0.0") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    const envBase = process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    if (!envBase.includes("0.0.0.0")) {
      return envBase;
    }
  }

  if (host) {
    return `${proto}://${host}`;
  }

  return "https://indigo-walrus-294806.hostingersite.com";
}

/**
 * Constructs a URL guaranteed to resolve against the public origin
 * rather than any internal 0.0.0.0 socket address.
 */
export function getPublicUrl(
  pathOrUrl: string,
  request?: Request | NextRequest,
): URL {
  const origin = getPublicOrigin(request);
  try {
    const parsed = new URL(pathOrUrl, origin);
    if (parsed.hostname === "0.0.0.0" || parsed.hostname === "127.0.0.1") {
      const publicBase = new URL(origin);
      parsed.protocol = publicBase.protocol;
      parsed.host = publicBase.host;
    }
    return parsed;
  } catch {
    return new URL(pathOrUrl, origin);
  }
}

/**
 * Sanitizes any Location header or redirect URL string so that
 * 0.0.0.0 or internal container ports are rewritten to the public domain.
 */
export function sanitizeRedirectLocation(
  location: string | null | undefined,
  request?: Request | NextRequest,
): string {
  const origin = getPublicOrigin(request);
  if (!location) return origin;

  try {
    const locUrl = new URL(location, origin);
    if (locUrl.hostname === "0.0.0.0" || locUrl.hostname === "127.0.0.1") {
      const publicBase = new URL(origin);
      locUrl.protocol = publicBase.protocol;
      locUrl.host = publicBase.host;
      return locUrl.toString();
    }
    return locUrl.toString();
  } catch {
    return location.replace(/https?:\/\/0\.0\.0\.0(?::\d+)?/g, origin);
  }
}
