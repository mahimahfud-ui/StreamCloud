import { json, preflight, readJson } from "../_shared/http.ts";
import { issueToken, SESSION_TTL_SECONDS, sha256Hex } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";

// 5 wrong PINs per IP -> 15 min lock; 30 wrong PINs globally -> 15 min lock.
const IP_LIMIT = { max: 5, windowSecs: 900, lockSecs: 900 };
const GLOBAL_LIMIT = { max: 30, windowSecs: 900, lockSecs: 900 };

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = await readJson(req, 2_000);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!pin || pin.length > 64) return json(req, { error: "Enter the PIN." }, 400);

  const db = serviceClient();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipKey = "ip:" + (await sha256Hex(ip)).slice(0, 32);

  for (const key of [ipKey, "global"]) {
    const { data, error } = await db.rpc("admin_lock_status", { p_key: key });
    if (error) return json(req, { error: "Admin database is not configured. Apply the StreamCloud admin migration." }, 500);
    if (data) {
      const retryAfter = Math.max(1, Math.ceil((new Date(data as string).getTime() - Date.now()) / 1000));
      return json(req, { error: "Too many attempts. Try again later.", retryAfter }, 429);
    }
  }

  const { data: matches, error: pinError } = await db.rpc("admin_pin_matches", { p_pin: pin });
  if (pinError) return json(req, { error: "Admin PIN storage is not configured. Apply the StreamCloud admin migration." }, 500);

  if (matches === true) {
    const { error: clearError } = await db.rpc("admin_clear_failures", { p_key: ipKey });
    if (clearError) return json(req, { error: "Could not reset the login limiter." }, 500);

    const session = await issueToken();
    const { error: saveError } = await db.from("admin_sessions").insert({
      token_hash: session.tokenHash,
      expires_at: new Date(session.expiresAt).toISOString(),
    });
    if (saveError) return json(req, { error: "Could not create an admin session." }, 500);

    await db.from("admin_activity").insert({
      action: "admin.login",
      entity_type: "session",
      entity_name: "Admin login",
    });
    return json(req, { ok: true, token: session.token, expiresAt: session.expiresAt, ttl: SESSION_TTL_SECONDS });
  }

  await new Promise((r) => setTimeout(r, 400));
  const l1 = await db.rpc("admin_record_failure", { p_key: ipKey, p_max: IP_LIMIT.max, p_window_secs: IP_LIMIT.windowSecs, p_lock_secs: IP_LIMIT.lockSecs });
  const l2 = await db.rpc("admin_record_failure", { p_key: "global", p_max: GLOBAL_LIMIT.max, p_window_secs: GLOBAL_LIMIT.windowSecs, p_lock_secs: GLOBAL_LIMIT.lockSecs });
  if (l1.error || l2.error) return json(req, { error: "Could not update the login limiter." }, 500);
  if (l1.data || l2.data) return json(req, { error: "Too many attempts. Try again later.", retryAfter: 900 }, 429);
  return json(req, { error: "Wrong PIN." }, 401);
});
