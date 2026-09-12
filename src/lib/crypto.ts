// Verschluesselte Ablage des KI-API-Schluessels: AES-GCM mit einem
// zufaelligen, nicht-exportierbaren Schluessel, der selbst nur lokal in
// IndexedDB liegt. Schuetzt vor beilaeufigem Klartext-Auslesen (z. B. in
// den Einstellungen oder beim Export), nicht vor vollem Geraetezugriff.
import { kvGet, kvSet } from "./db/userDb";

const KEY_STORAGE = "amibel_api_key_material";

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = await kvGet<JsonWebKey>(KEY_STORAGE);
  if (stored) {
    return crypto.subtle.importKey("jwk", stored, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await kvSet(KEY_STORAGE, jwk);
  return key;
}

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  return `${bufToBase64(iv.buffer)}.${bufToBase64(cipher)}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  if (!stored) return "";
  const [ivB64, cipherB64] = stored.split(".");
  if (!ivB64 || !cipherB64) return "";
  const key = await getOrCreateKey();
  const iv = base64ToBuf(ivB64);
  const cipher = base64ToBuf(cipherB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 4)}${"•".repeat(Math.min(20, plain.length - 8))}${plain.slice(-4)}`;
}
