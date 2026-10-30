import { parsePublicUrl, readLimited, safeFetch } from "./urls.ts";

/** Accept only a reachable, publicly hosted image with a recognizable image signature. */
export async function verifyImageUrl(raw: string): Promise<boolean> {
  const url = parsePublicUrl(raw);
  if (!url) return false;
  try {
    const { res } = await safeFetch(url, {
      headers: { Range: "bytes=0-63", Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.5" },
      timeoutMs: 6500,
    });
    if (res.status !== 200 && res.status !== 206) { await res.body?.cancel(); return false; }
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/")) { await res.body?.cancel(); return false; }
    const bytes = await readLimited(res, 64);
    if (bytes.length < 4) return false;

    const ascii = new TextDecoder().decode(bytes);
    const png = bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG";
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const gif = ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
    const webp = ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP";
    const ico = bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
    const bmp = ascii.startsWith("BM");
    const avif = ascii.slice(4, 8) === "ftyp" && /avif|avis/.test(ascii.slice(8, 16));
    const svg = type === "image/svg+xml" && /<svg(?:\s|>)/i.test(ascii);
    return png || jpeg || gif || webp || ico || bmp || avif || svg;
  } catch {
    return false;
  }
}
