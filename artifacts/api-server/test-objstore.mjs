import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const client = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const searchPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map(s=>s.trim()).filter(Boolean);
console.log("PUBLIC search paths:", searchPaths);
const base = searchPaths[0];
const trimmed = base.startsWith("/") ? base.slice(1) : base;
const parts = trimmed.split("/");
const bucketName = parts[0];
const prefix = parts.slice(1).join("/");
console.log("bucket:", bucketName, "prefix:", prefix);

// Tiny 1x1 transparent PNG
const PNG_1x1 = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FE94F40FD20000000049454E44AE426082",
  "hex"
);
const filename = `test-${Date.now()}.png`;
const objectName = (prefix ? `${prefix}/uploads/` : "uploads/") + filename;
console.log("writing object:", objectName);
await client.bucket(bucketName).file(objectName).save(PNG_1x1, {
  contentType: "image/png",
  resumable: false,
});
console.log("OK uploaded. fetching via API...");

const r = await fetch(`http://localhost:80/api/uploads/${filename}`);
console.log("status:", r.status, "content-type:", r.headers.get("content-type"), "len:", r.headers.get("content-length"));
const body = Buffer.from(await r.arrayBuffer());
console.log("body matches:", body.equals(PNG_1x1));

// cleanup
await client.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
console.log("cleaned up");
