import { useCallback } from "react";
import { get, set, del } from "idb-keyval";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

/* ─── Utilities di conversione ─────────────────────────────────────── */

function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642ab(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

/* ─── Gestione chiavi RSA (una coppia per utente) ─────────────────── */

export async function generateRsaKeyPair(): Promise<{
  publicKey: string;   // SPKI base64
  privateKey: string;  // PKCS8 base64
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );

  const [pubSpki, privPkcs8] = await Promise.all([
    crypto.subtle.exportKey("spki", keyPair.publicKey),
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  ]);

  return {
    publicKey: ab2b64(pubSpki),
    privateKey: ab2b64(privPkcs8),
  };
}

export async function storePrivateKey(userId: number, privateKeyB64: string): Promise<void> {
  await set(`rsa-priv-${userId}`, privateKeyB64);
}

export async function getPrivateKey(userId: number): Promise<CryptoKey | null> {
  const b64 = await get(`rsa-priv-${userId}`);
  if (!b64) return null;

  return crypto.subtle.importKey(
    "pkcs8",
    b642ab(b64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b642ab(publicKeyB64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

/* ─── Generazione e wrapping chiave AES conversazione ─────────────── */

export async function generateConversationKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return ab2b64(raw);
}

export async function wrapAesKey(aesKeyB64: string, rsaPublicKeyB64: string): Promise<string> {
  const rsaKey = await importPublicKey(rsaPublicKeyB64);
  const aesRaw = b642ab(aesKeyB64);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaKey,
    aesRaw,
  );
  return ab2b64(encrypted);
}

export async function unwrapAesKey(encryptedAesKeyB64: string, userId: number): Promise<CryptoKey> {
  const privKey = await getPrivateKey(userId);
  if (!privKey) throw new Error("Chiave privata non trovata");

  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privKey,
    b642ab(encryptedAesKeyB64),
  );

  return crypto.subtle.importKey(
    "raw",
    decrypted,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ─── Criptare / Decriptare messaggi ──────────────────────────────── */

export async function encryptMessage(
  aesKey: CryptoKey,
  plaintext: string,
): Promise<{ encryptedContent: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded,
  );
  return {
    encryptedContent: ab2b64(encrypted),
    iv: ab2b64(iv.buffer),
  };
}

export async function decryptMessage(
  aesKey: CryptoKey,
  encryptedContent: string,
  iv: string,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b642ab(iv) },
    aesKey,
    b642ab(encryptedContent),
  );
  return new TextDecoder().decode(decrypted);
}

/* ─── API helpers ──────────────────────────────────────────────────── */

export async function fetchPublicKey(userId: number): Promise<string> {
  const res = await apiFetch(`${BASE}api/friends/keys/${userId}`);
  if (!res.ok) throw new Error("Chiave non trovata");
  const data = await res.json();
  return data.publicKey as string;
}

export async function uploadPublicKey(publicKey: string): Promise<void> {
  await apiFetch(`${BASE}api/friends/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey }),
  });
}

export async function exchangeKeys(
  friendshipId: number,
  keyForRequester: string,
  keyForReceiver: string,
): Promise<void> {
  await apiFetch(`${BASE}api/friends/keys/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendshipId, keyForRequester, keyForReceiver }),
  });
}

export async function fetchEncryptedKey(friendshipId: number): Promise<string> {
  const res = await apiFetch(`${BASE}api/friends/keys/exchange/${friendshipId}`);
  if (!res.ok) throw new Error("Chiave conversazione non trovata");
  const data = await res.json();
  return data.encryptedKey as string;
}

/* ─── Hook React ──────────────────────────────────────────────────── */

export function useChatEncryption(userId: number | null) {
  const ensureKeys = useCallback(async () => {
    if (!userId) return;
    const existing = await get(`rsa-priv-${userId}`);
    if (existing) return true;

    const { publicKey, privateKey } = await generateRsaKeyPair();
    await storePrivateKey(userId, privateKey);
    await uploadPublicKey(publicKey);
    return true;
  }, [userId]);

  return { ensureKeys };
}
