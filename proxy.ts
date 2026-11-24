import { NextResponse, type NextRequest } from "next/server";

function firstHeader(value: string | null) {
  return (value || "").split(",")[0]?.trim() || "";
}

function makeNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}

function pageCsp(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'nonce-" + nonce + "' 'strict-dynamic'",
    "script-src-attr 'none'",
    "style-src 'self' 'nonce-" + nonce + "'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function csrfFailure(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  // Protect state-changing API requests from cross-site submission.
  if (isApi && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return csrfFailure("Xavfsizlik siyosati: boshqa saytdan yuborilgan so‘rov bloklandi.");
    }

    const origin = request.headers.get("origin");
    if (origin) {
      const host = firstHeader(request.headers.get("x-forwarded-host")) || firstHeader(request.headers.get("host"));
      const proto = firstHeader(request.headers.get("x-forwarded-proto")) || request.nextUrl.protocol.replace(":", "") || "https";
      if (!host || origin !== proto + "://" + host) {
        return csrfFailure("Xavfsizlik siyosati: Origin mos kelmadi.");
      }
    }
  }

  // API JSON responses do not need a document CSP.
  if (isApi) return NextResponse.next();

  const nonce = makeNonce();
  const csp = pageCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
