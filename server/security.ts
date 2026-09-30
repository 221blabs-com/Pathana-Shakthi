// Small, dependency-free hardening for the Express server: per-client rate
// limits and standard security headers. In-memory, so each server instance
// limits independently (fine for one Render instance; a shared store would
// be needed when scaling out horizontally).
import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Drop expired buckets now and then so the map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000).unref?.();

export function clientKey(req: Request): string {
  const uid = (req as any).firebaseUser?.uid;
  return uid ? `uid:${uid}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

// Allows `max` requests per `windowMs` per client (signed-in user, else IP)
// for the routes it is mounted on; answers 429 with Retry-After beyond that.
export function rateLimit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, error: `Too many requests. Please wait ${retryAfter} seconds and try again.` });
    }
    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // The reader needs the microphone; nothing needs camera/location/payment.
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.removeHeader("X-Powered-By");
  next();
}

// Short-lived cache for per-request profile lookups (users/{uid}), so every
// API call doesn't cost a Firestore read. Profiles change rarely; 60 s is the
// longest a role change can take to apply.
const profileCache = new Map<string, { value: any; expiresAt: number }>();
export async function cachedProfile(uid: string, load: () => Promise<any>): Promise<any> {
  const hit = profileCache.get(uid);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await load();
  profileCache.set(uid, { value, expiresAt: Date.now() + 60_000 });
  if (profileCache.size > 5000) profileCache.delete(profileCache.keys().next().value as string);
  return value;
}
export function forgetProfile(uid: string) {
  profileCache.delete(uid);
}
