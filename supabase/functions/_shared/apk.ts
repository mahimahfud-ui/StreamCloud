import { readLimited, safeFetch } from "./urls.ts";

/** A direct APK URL is verified only if it is reachable and the file starts with the ZIP/APK signature. */
export async function verifyApk(raw: string): Promise<{ ok: boolean; reason?: string; size?: number }> {
  try {
    const { res } = await safeFetch(new URL(raw), { headers: { Range: "bytes=0-3" }, timeoutMs: 10000 });
    if (res.status !== 200 && res.status !== 206) { await res.body?.cancel(); return { ok: false, reason: `Server answered ${res.status}.` }; }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (type.startsWith("text/html")) { await res.body?.cancel(); return { ok: false, reason: "Link opens a web page, not an APK file." }; }
    const range = res.headers.get("content-range")?.match(/\/(\d+)$/);
    const size = range ? Number(range[1]) : Number(res.headers.get("content-length") ?? 0) || undefined;
    const b = await readLimited(res, 4);
    if (!(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04)) return { ok: false, reason: "File is not an APK/ZIP archive." };
    if (size !== undefined && size < 100_000) return { ok: false, reason: "File is too small to be an app." };
    return { ok: true, size };
  } catch (e) {
    return { ok: false, reason: (e as Error).message || "Could not reach the file." };
  }
}
