// Formato de public/data.enc.json (lo escribe dashboard.py en el box):
// { v:1, kdf:"PBKDF2-SHA256", iter:600000, salt:b64, iv:b64, ct:b64 }  ct = AES-256-GCM(JSON de datos)
export interface Enc { v: number; iter: number; salt: string; iv: string; ct: string }
const b = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function decrypt<T>(enc: Enc, password: string): Promise<T> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b(enc.salt), iterations: enc.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(enc.iv) }, key, b(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
