import { json, preflight, readJson } from "../_shared/http.ts";
import { getSessionToken, requireAdmin, sha256Hex } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { validateListing, SECTIONS } from "../_shared/listing.ts";
import { verifyApk } from "../_shared/apk.ts";
import { verifyImageUrl } from "../_shared/images.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETTINGS_MAX = 100_000;
const SETTINGS_DEFAULT = {
  schemaVersion: 1,
  site: {},
  appearance: {},
  sections: {
    sites: { visible: true, title: "Movie Websites" },
    apps: { visible: true, title: "Movie Apps" },
    music: { visible: true, title: "Music Apps" },
    gaming: { visible: true, title: "Gaming Websites" },
    tv: { visible: true, title: "TV Apps" },
    recs: { visible: true, title: "Recommendations" },
    order: ["sites", "apps", "music", "gaming", "tv", "recs"],
  },
  content: { overrides: {}, hidden: [], order: {} },
};

function cleanText(v: unknown, max = 160): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function normalizeSettings(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return null; }
  if (serialized.length > SETTINGS_MAX) return null;
  const v = value as Record<string, unknown>;
  const site = v.site && typeof v.site === "object" && !Array.isArray(v.site) ? v.site as Record<string, unknown> : {};
  const appearance = v.appearance && typeof v.appearance === "object" && !Array.isArray(v.appearance) ? v.appearance as Record<string, unknown> : {};
  const sections = v.sections && typeof v.sections === "object" && !Array.isArray(v.sections) ? v.sections as Record<string, unknown> : {};
  const content = v.content && typeof v.content === "object" && !Array.isArray(v.content) ? v.content as Record<string, unknown> : {};
  return {
    schemaVersion: 1,
    site: {
      ...site,
      title: cleanText(site.title, 100),
      description: cleanText(site.description, 300),
      keywords: cleanText(site.keywords, 300),
      instagramUrl: cleanText(site.instagramUrl, 500),
      themeColor: typeof site.themeColor === "string" && /^#[0-9a-f]{6}$/i.test(site.themeColor) ? site.themeColor : "",
      heroVisible: site.heroVisible !== false,
      heroEyebrow: cleanText(site.heroEyebrow, 80),
      heroTitle: cleanText(site.heroTitle, 100),
      heroDescription: cleanText(site.heroDescription, 300),
      announcementEnabled: site.announcementEnabled === true,
      announcement: cleanText(site.announcement, 240),
      announcementLink: cleanText(site.announcementLink, 500),
      announcementLabel: cleanText(site.announcementLabel, 36),
    },
    appearance,
    sections,
    content,
  };
}

function objectName(row: Record<string, unknown>): string {
  return cleanText(row.name, 160) || cleanText(row.title, 160) || "Untitled";
}

async function logActivity(db: ReturnType<typeof serviceClient>, action: string, entityType = "site", entityId?: string, entityName?: string, details: Record<string, unknown> = {}) {
  await db.from("admin_activity").insert({
    action, entity_type: entityType, entity_id: entityId || null, entity_name: entityName || null, details,
  });
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const body = await readJson(req, 256_000);
  if (!body) return json(req, { error: "Invalid request." }, 400);
  const action = String(body.action ?? "");

  // Logout is deliberately available to clear an expired cookie as well.
  if (action === "logout") {
    const token = getSessionToken(req);
    if (token) {
      const db = serviceClient();
      const hash = await sha256Hex(token);
      const { data: revoked } = await db.from("admin_sessions")
        .delete()
        .eq("token_hash", hash)
        .gt("expires_at", new Date().toISOString())
        .select("token_hash");
      // Only a real, active session is allowed to create a logout audit entry.
      if (revoked && revoked.length) {
        await db.from("admin_activity").insert({ action: "admin.logout", entity_type: "session", entity_name: "Admin logout" });
      }
    }
    return json(req, { ok: true });
  }

  if (!(await requireAdmin(req))) return json(req, { error: "Admin session expired. Enter the PIN again." }, 401);
  const db = serviceClient();

  if (action === "list") {
    const { data, error } = await db.from("listings").select("*")
      .order("position", { ascending: true }).order("created_at", { ascending: false }).limit(500);
    if (error) return json(req, { error: "Could not load listings." }, 500);
    return json(req, { listings: data });
  }

  if (action === "overview") {
    const [listingResult, activityResult, settingsResult] = await Promise.all([
      db.from("listings").select("id,section,published", { count: "exact" }).limit(1000),
      db.from("admin_activity").select("id,action,entity_type,entity_name,created_at").order("created_at", { ascending: false }).limit(8),
      db.from("site_settings").select("settings,updated_at").eq("id", "global").maybeSingle(),
    ]);
    if (listingResult.error) return json(req, { error: "Could not load dashboard stats." }, 500);
    const all = listingResult.data ?? [];
    const counts: Record<string, number> = { all: all.length, published: 0, hidden: 0 };
    for (const s of SECTIONS) counts[s] = 0;
    for (const r of all) {
      counts[String(r.section)] = (counts[String(r.section)] ?? 0) + 1;
      if (r.published) counts.published++; else counts.hidden++;
    }
    return json(req, { counts, activity: activityResult.data ?? [], settings: settingsResult.data?.settings ?? SETTINGS_DEFAULT, settingsUpdatedAt: settingsResult.data?.updated_at ?? null });
  }

  if (action === "settings-get") {
    const { data, error } = await db.from("site_settings").select("settings,updated_at").eq("id", "global").maybeSingle();
    if (error) return json(req, { error: "Could not load site settings." }, 500);
    return json(req, { settings: data?.settings ?? SETTINGS_DEFAULT, updatedAt: data?.updated_at ?? null });
  }

  if (action === "settings-save") {
    const settings = normalizeSettings(body.settings);
    if (!settings) return json(req, { error: "Settings are invalid or too large (maximum 100 KB)." }, 422);
    const { error } = await db.from("site_settings").upsert({ id: "global", settings, updated_at: new Date().toISOString() });
    if (error) return json(req, { error: "Could not save site settings." }, 500);
    await logActivity(db, "settings.saved", "settings", "global", "Site settings");
    return json(req, { ok: true, settings });
  }

  if (action === "activity-list") {
    const { data, error } = await db.from("admin_activity").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return json(req, { error: "Could not load activity." }, 500);
    return json(req, { activity: data ?? [] });
  }

  if (action === "pin-change") {
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (pin.length < 4 || pin.length > 64) return json(req, { error: "The new PIN must be 4–64 characters." }, 422);
    const { error } = await db.rpc("admin_update_pin", { p_pin: pin });
    if (error) return json(req, { error: "Could not update the admin PIN." }, 500);
    await logActivity(db, "admin.pin_changed", "security", "admin", "Admin PIN");
    return json(req, { ok: true, reLoginRequired: true });
  }

  if (action === "bulk") {
    const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string" && UUID.test(v)).slice(0, 250) : [];
    const operation = String(body.operation ?? "");
    if (!ids.length) return json(req, { error: "Select at least one valid listing." }, 422);
    if (operation === "delete") {
      const { data, error } = await db.from("listings").delete().in("id", ids).select("id");
      if (error) return json(req, { error: "Bulk delete failed." }, 500);
      await logActivity(db, "listings.bulk_deleted", "listing", undefined, undefined, { count: data?.length ?? 0 });
      return json(req, { ok: true, affected: data?.length ?? 0 });
    }
    if (operation === "publish" || operation === "hide") {
      const { data, error } = await db.from("listings").update({ published: operation === "publish", updated_at: new Date().toISOString() }).in("id", ids).select("id");
      if (error) return json(req, { error: "Bulk visibility update failed." }, 500);
      await logActivity(db, "listings.bulk_" + operation, "listing", undefined, undefined, { count: data?.length ?? 0 });
      return json(req, { ok: true, affected: data?.length ?? 0 });
    }
    if (operation === "move") {
      const section = String(body.section ?? "");
      const category = cleanText(body.category, 60);
      if (!SECTIONS.includes(section as typeof SECTIONS[number]) || !category) return json(req, { error: "Choose a valid destination section and category." }, 422);
      const { data, error } = await db.from("listings").update({ section, category, updated_at: new Date().toISOString() }).in("id", ids).select("id");
      if (error) return json(req, { error: "Bulk move failed." }, 500);
      await logActivity(db, "listings.bulk_moved", "listing", undefined, undefined, { count: data?.length ?? 0, section, category });
      return json(req, { ok: true, affected: data?.length ?? 0 });
    }
    return json(req, { error: "Unknown bulk operation." }, 400);
  }

  if (action === "reorder") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 500) as Array<Record<string, unknown>> : [];
    if (!items.length || items.some((x) => typeof x.id !== "string" || !UUID.test(x.id) || !Number.isInteger(Number(x.position)) || Number(x.position) < 0 || Number(x.position) > 10000)) {
      return json(req, { error: "Invalid item order." }, 422);
    }
    for (const item of items) {
      const { error } = await db.from("listings").update({ position: Number(item.position), updated_at: new Date().toISOString() }).eq("id", item.id);
      if (error) return json(req, { error: "Could not save item order." }, 500);
    }
    await logActivity(db, "listings.reordered", "listing", undefined, undefined, { count: items.length });
    return json(req, { ok: true, affected: items.length });
  }

  if (action === "import") {
    const input = Array.isArray(body.listings) ? body.listings.slice(0, 150) as Array<Record<string, unknown>> : [];
    if (!input.length && !body.settings) return json(req, { error: "The import contains no supported content or settings." }, 422);
    let added = 0, skipped = 0;
    const errors: string[] = [];
    for (const item of input) {
      const { row, errors: fields } = validateListing(item);
      if (!row || fields) { skipped++; if (errors.length < 10) errors.push(objectName(item) + ": invalid fields."); continue; }
      if (row.download_url) {
        const v = await verifyApk(String(row.download_url));
        if (v.ok) row.download_verified = true;
        else { row.download_url = null; row.download_verified = false; }
      }
      const { error } = await db.from("listings").insert(row);
      if (error) { skipped++; if (errors.length < 10) errors.push(objectName(item) + ": already listed or could not save."); }
      else added++;
    }
    if (body.settings) {
      const settings = normalizeSettings(body.settings);
      if (!settings) return json(req, { error: "Imported settings are invalid or too large." }, 422);
      const { error } = await db.from("site_settings").upsert({ id: "global", settings, updated_at: new Date().toISOString() });
      if (error) return json(req, { error: "Could not import settings." }, 500);
    }
    await logActivity(db, "data.imported", "data", undefined, "Import", { added, skipped });
    return json(req, { ok: true, added, skipped, errors });
  }

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!UUID.test(id)) return json(req, { error: "Invalid listing id." }, 400);
    const { data: old } = await db.from("listings").select("name,section").eq("id", id).maybeSingle();
    const { error, count } = await db.from("listings").delete({ count: "exact" }).eq("id", id);
    if (error) return json(req, { error: "Could not delete the listing." }, 500);
    if (count === 0) return json(req, { error: "Listing not found." }, 404);
    await logActivity(db, "listing.deleted", "listing", id, old?.name, { section: old?.section });
    return json(req, { ok: true });
  }

  if (action === "create" || action === "update") {
    const id = String(body.id ?? "");
    if (action === "update" && !UUID.test(id)) return json(req, { error: "Invalid listing id." }, 400);
    const { row, errors } = validateListing((body.listing ?? {}) as Record<string, unknown>);
    if (errors) return json(req, { error: "Please fix the highlighted fields.", fields: errors }, 422);

    if (body.requireVerifiedLogo === true) {
      if (!row!.logo_url) return json(req, { error: "An official logo URL is required.", fields: { logo_url: "Add an official image URL." } }, 422);
      if (!(await verifyImageUrl(String(row!.logo_url)))) {
        return json(req, { error: "The logo URL did not return a verifiable image.", fields: { logo_url: "Use a public HTTPS image URL with a valid image signature." } }, 422);
      }
    }

    if (body.requireVerifiedDownload === true && !row!.download_url) {
      return json(req, { error: "A direct app package URL is required.", fields: { download_url: "Paste a direct APK/XAPK package URL." } }, 422);
    }
    if (body.requireVerifiedDownload === true && row!.download_url) {
      const packageUrl = new URL(String(row!.download_url));
      if (!/\\.(?:apk|xapk|apks)$/i.test(packageUrl.pathname)) {
        return json(req, { error: "Only direct APK/XAPK/APKS package files can be published as app downloads.", fields: { download_url: "Use a direct .apk, .xapk or .apks file URL." } }, 422);
      }
    }
    if (row!.download_url) {
      const v = await verifyApk(String(row!.download_url));
      if (v.ok) row!.download_verified = true;
      else if (body.requireVerifiedDownload === true || body.keepUnverifiedDownload !== true) {
        return json(req, { error: "Download link not verified: " + v.reason, fields: { download_url: "Not a verified APK/package file. Paste a direct package URL and run detection again." } }, 422);
      }
    }
    const q = action === "create"
      ? db.from("listings").insert(row!).select().single()
      : db.from("listings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    const { data, error } = await q;
    if (error) {
      if (error.code === "23505") {
        const field = String(error.message).toLowerCase().includes("imdb") ? "imdb_id" : "url";
        return json(req, { error: field === "imdb_id" ? "This title is already listed." : "This URL is already listed.", fields: { [field]: "Duplicate." } }, 409);
      }
      if (error.code === "PGRST116") return json(req, { error: "Listing not found." }, 404);
      return json(req, { error: "Could not save the listing." }, 500);
    }
    await logActivity(db, action === "create" ? "listing.created" : "listing.updated", "listing", data.id, data.name, { section: data.section });
    return json(req, { listing: data });
  }

  return json(req, { error: "Unknown action." }, 400);
});
