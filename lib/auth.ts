// Edge/Node-safe: only Web Crypto, no node: imports (used by proxy.ts too).

export type Session = { email: string; exp: number };

/** Minimal cookie shape satisfied by both `await cookies()` and `request.cookies` / `response.cookies`. */
export type CookieReader = { get(name: string): { value: string } | undefined };
export type CookieWriter = {
  set(name: string, value: string, opts?: Record<string, unknown>): unknown;
  delete(name: string): unknown;
};

export interface Auth {
  verifyCredentials(email: string, password: string): Promise<boolean>;
  createSession(cookies: CookieWriter, email: string): Promise<void>;
  readSession(cookies: CookieReader): Promise<Session | null>;
  destroySession(cookies: CookieWriter): Promise<void>;
}

export const SESSION_COOKIE = "session";
const MAX_AGE_S = 7 * 24 * 3600;
const enc = new TextEncoder();

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET chưa đặt hoặc quá ngắn (>= 16 ký tự)");
  return s;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Constant-time string compare via HMAC of both sides. */
export async function safeEqual(a: string, b: string) {
  const k = await hmacKey();
  const [x, y] = await Promise.all([crypto.subtle.sign("HMAC", k, enc.encode(a)), crypto.subtle.sign("HMAC", k, enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

export async function signToken(s: Session) {
  const body = b64url(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(token: string | undefined, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64url(body))) as Session;
    return typeof s.email === "string" && s.exp > now ? s : null;
  } catch {
    return null;
  }
}

/** Local implementation: one account from ADMIN_EMAIL / ADMIN_PASSWORD, HMAC-signed httpOnly cookie. */
class LocalAuth implements Auth {
  async verifyCredentials(email: string, password: string) {
    const e = process.env.ADMIN_EMAIL, p = process.env.ADMIN_PASSWORD;
    if (!e || !p) return false;
    const [a, b] = await Promise.all([safeEqual(email.trim().toLowerCase(), e.toLowerCase()), safeEqual(password, p)]);
    return a && b;
  }
  async createSession(cookies: CookieWriter, email: string) {
    const token = await signToken({ email, exp: Date.now() + MAX_AGE_S * 1000 });
    cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // localhost counts as secure in browsers
      path: "/",
      maxAge: MAX_AGE_S,
    });
  }
  async readSession(cookies: CookieReader) {
    return verifyToken(cookies.get(SESSION_COOKIE)?.value);
  }
  async destroySession(cookies: CookieWriter) {
    cookies.delete(SESSION_COOKIE);
  }
}

export const auth: Auth = new LocalAuth();
