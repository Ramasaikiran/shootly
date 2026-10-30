// File storage for portfolio photos (public) and ID documents (private).
// Disk driver for a single server with a persistent disk. For several servers, swap in S3 or Supabase Storage with the same methods.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const NAME = /^[a-f0-9]{36}\.(jpg|png|webp|pdf)$/;
const newName = ext => randomBytes(18).toString("hex") + "." + ext;

// Detect type from file content, never from the name or the claimed type.
export function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  return null;
}

// data: base64 string, or a data: URL. Throws Error with a user-safe message.
export function decodeUpload(data, { max, allow }) {
  if (typeof data !== "string" || !data) throw new Error("Choose a file.");
  const b64 = data.replace(/^data:[^,]{0,100},/, "");
  if (b64.length > Math.ceil(max / 3) * 4 + 4) throw new Error(`File is too large. Limit is ${Math.round(max / 1048576)} MB.`);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error("That file could not be read.");
  const buf = Buffer.from(b64, "base64");
  if (buf.length > max) throw new Error(`File is too large. Limit is ${Math.round(max / 1048576)} MB.`);
  const ext = sniff(buf);
  if (!ext || !allow.includes(ext)) throw new Error("Unsupported file type. Allowed: " + allow.map(x => x.toUpperCase()).join(", ") + ".");
  return { buf, ext };
}

function make(store) {
  return {
    putPublic(buf, ext) { const f = newName(ext); store.write("public", f, buf); return f; },
    putPrivate(buf, ext) { const f = newName(ext); store.write("private", f, buf); return f; },
    readPublic(f) { if (!NAME.test(f) || f.endsWith(".pdf")) return null; const b = store.read("public", f); return b ? { buf: b, mime: MIME[f.split(".")[1]] } : null; },
    readPrivate(f) { if (!NAME.test(f)) return null; const b = store.read("private", f); return b ? { buf: b, mime: MIME[f.split(".")[1]] } : null; },
    remove(kind, f) { if (NAME.test(f || "")) store.remove(kind, f); }
  };
}
export function diskUploads(dir) {
  const d = { public: path.join(dir, "public"), private: path.join(dir, "private") };
  fs.mkdirSync(d.public, { recursive: true, mode: 0o755 });
  fs.mkdirSync(d.private, { recursive: true, mode: 0o700 });
  return make({
    write: (k, f, b) => fs.writeFileSync(path.join(d[k], f), b, { mode: 0o600 }),
    read: (k, f) => { try { return fs.readFileSync(path.join(d[k], f)); } catch { return null; } },
    remove: (k, f) => { try { fs.unlinkSync(path.join(d[k], f)); } catch {} }
  });
}
export function memoryUploads() {
  const m = new Map();
  const u = make({ write: (k, f, b) => m.set(k + "/" + f, b), read: (k, f) => m.get(k + "/" + f) || null, remove: (k, f) => m.delete(k + "/" + f) });
  u.count = () => m.size;
  return u;
}
