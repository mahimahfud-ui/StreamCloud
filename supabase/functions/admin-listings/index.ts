import { json, preflight, readJson } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { validateListing } from "../_shared/listing.ts";
import { verifyApk } from "../_shared/apk.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (!(await requireAdmin(req))) return json(req, { error: "Admin session expired. Enter the PIN again." }, 401);

  const body = await readJson(req);
  if (!body) return json(req, { error: "Invalid request." }, 400);
  const db = serviceClient();
  const action = String(body.action ?? "");

  if (action === "list") {
    const { data, error } = await db.from("listings").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) return json(req, { error: "Could not load listings." }, 500);
    return json(req, { listings: data });
  }

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!UUID.test(id)) return json(req, { error: "Invalid listing id." }, 400);
    const { error, count } = await db.from("listings").delete({ count: "exact" }).eq("id", id);
    if (error) return json(req, { error: "Could not delete the listing." }, 500);
    if (!count) return json(req, { error: "Listing not found." }, 404);
    return json(req, { ok: true });
  }

  if (action === "create" || action === "update") {
    const id = String(body.id ?? "");
    if (action === "update" && !UUID.test(id)) return json(req, { error: "Invalid listing id." }, 400);
    const { row, errors } = validateListing((body.listing ?? {}) as Record<string, unknown>);
    if (errors) return json(req, { error: "Please fix the highlighted fields.", fields: errors }, 422);

    // Re-verify any download link on the server; never trust the browser's claim.
    if (row!.download_url) {
      const v = await verifyApk(row!.download_url as string);
      if (v.ok) row!.download_verified = true;
      else if (body.keepUnverifiedDownload !== true) {
        return json(req, { error: `Download link not verified: ${v.reason}`, fields: { download_url: "Not a verified APK link. Clear it, fix it, or keep it as unverified." } }, 422);
      }
    }

    const q = action === "create"
      ? db.from("listings").insert(row!).select().single()
      : db.from("listings").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    const { data, error } = await q;
    if (error) {
      if (error.code === "23505") {
        const field = String(error.message).includes("imdb") ? "imdb_id" : "url";
        return json(req, { error: field === "imdb_id" ? "This title is already listed." : "This URL is already listed.", fields: { [field]: "Duplicate." } }, 409);
      }
      if (error.code === "PGRST116") return json(req, { error: "Listing not found." }, 404);
      return json(req, { error: "Could not save the listing." }, 500);
    }
    return json(req, { listing: data });
  }

  return json(req, { error: "Unknown action." }, 400);
});
