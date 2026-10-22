import { json, preflight, readJson } from "../_shared/http.ts";
import { issueToken, safeEqual, sha256Hex, SESSION_TTL_SECONDS } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";

// 5 wrong PINs per IP -> 15 min lock. 30 wrong PINs across all IPs -> 15 min global lock.
const IP_LIMIT = { max: 5, windowSecs: 900, lockSecs: 900 };
const GLOBAL_LIMIT = { max: 30, windowSecs: 900, lockSecs: 900 };

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const pinSecret = Deno.env.get("ADMIN_PIN");
  if (!pinSecret || !Deno.env.get("ADMIN_SESSION_SECRET")) {
    return json(req, { error: "Admin access is not configured on the server." }, 500);
  }
  const body = await readJson(req, 2_000);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!pin || pin.length > 64) return json(req, { error: "Enter the PIN." }, 400);

  const db = serviceClient();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipKey = "ip:" + (await sha256Hex(ip + ":" + Deno.env.get("ADMIN_SESSION_SECRET"))).slice(0, 32);

  for (const key of [ipKey, "global"]) {
    const { data, error } = await db.rpc("admin_lock_status", { p_key: key });
    // Fail closed: if the migration was not applied, rate limiting would silently not work.
    if (error) return json(req, { error: "Server database is not set up. Run the SQL migration first." }, 500);
    if (data) {
      const retryAfter = Math.max(1, Math.ceil((new Date(data as string).getTime() - Date.now()) / 1000));
      return json(req, { error: "Too many wrong attempts. Try again later.", retryAfter }, 429);
    }
  }

  if (await safeEqual(pin, pinSecret)) {
    await db.rpc("admin_clear_failures", { p_key: ipKey });
    const { token, expiresAt } = await issueToken();
    return json(req, { token, expiresAt, ttl: SESSION_TTL_SECONDS });
  }

  await new Promise((r) => setTimeout(r, 400));
  const l1 = await db.rpc("admin_record_failure", { p_key: ipKey, p_max: IP_LIMIT.max, p_window_secs: IP_LIMIT.windowSecs, p_lock_secs: IP_LIMIT.lockSecs });
  const l2 = await db.rpc("admin_record_failure", { p_key: "global", p_max: GLOBAL_LIMIT.max, p_window_secs: GLOBAL_LIMIT.windowSecs, p_lock_secs: GLOBAL_LIMIT.lockSecs });
  if (l1.data || l2.data) return json(req, { error: "Too many wrong attempts. Try again later.", retryAfter: 900 }, 429);
  return json(req, { error: "Wrong PIN." }, 401);
});
