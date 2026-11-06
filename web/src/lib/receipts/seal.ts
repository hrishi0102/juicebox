// Encryption for shared weeks. Works in Node and the browser (pure JS, no WebCrypto needed).
//
// A person's full week (list, PRs, AI records) is encrypted with a fresh AES-256-GCM key before it
// leaves the laptop, so storage nodes and gateways only ever see ciphertext. That key, plus where
// the ciphertext lives, is then "sealed" to the company's public key (ECIES on secp256k1: an
// ephemeral key, ECDH, HKDF-SHA256, AES-256-GCM). Only someone holding the company key can open it.

import { gcm } from "@noble/ciphers/aes";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils";

const INFO = utf8ToBytes("receipts/seal/v1");

const strip = (h: string) => (h.startsWith("0x") ? h.slice(2) : h);

/** Encrypt data with a fresh key. Returns the key and the sealed blob (iv || ciphertext+tag). */
export function encryptBlob(data: Uint8Array): { key: Uint8Array; blob: Uint8Array } {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(data);
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv, 0);
  blob.set(ct, iv.length);
  return { key, blob };
}

export function decryptBlob(key: Uint8Array, blob: Uint8Array): Uint8Array {
  return gcm(key, blob.slice(0, 12)).decrypt(blob.slice(12));
}

/** Seal a small secret to a secp256k1 public key (hex, compressed or not). Returns hex. */
export function sealTo(publicKeyHex: string, secret: Uint8Array): string {
  const eph = secp256k1.utils.randomPrivateKey();
  const ephPub = secp256k1.getPublicKey(eph, true); // 33 bytes
  const shared = secp256k1.getSharedSecret(eph, hexToBytes(strip(publicKeyHex)), true);
  const key = hkdf(sha256, shared.slice(1), ephPub, INFO, 32);
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(secret);
  return bytesToHex(ephPub) + bytesToHex(iv) + bytesToHex(ct);
}

/** Open a sealed secret with the matching private key (hex, with or without 0x). */
export function openSealed(privateKeyHex: string, sealedHex: string): Uint8Array {
  const raw = hexToBytes(strip(sealedHex));
  const ephPub = raw.slice(0, 33);
  const iv = raw.slice(33, 45);
  const ct = raw.slice(45);
  const shared = secp256k1.getSharedSecret(hexToBytes(strip(privateKeyHex)), ephPub, true);
  const key = hkdf(sha256, shared.slice(1), ephPub, INFO, 32);
  return gcm(key, iv).decrypt(ct);
}

/** Compressed public key (hex, no 0x) for a private key: what employees encrypt to. */
export function publicKeyOf(privateKeyHex: string): string {
  return bytesToHex(secp256k1.getPublicKey(hexToBytes(strip(privateKeyHex)), true));
}

/** What gets sealed for the company: where the encrypted week is, and its key. */
export type SealedPointer = { ref: string; key: string };

export function sealPointer(companyPublicKey: string, p: SealedPointer): string {
  return sealTo(companyPublicKey, utf8ToBytes(JSON.stringify(p)));
}

export function openPointer(companyPrivateKey: string, sealed: string): SealedPointer {
  return JSON.parse(new TextDecoder().decode(openSealed(companyPrivateKey, sealed))) as SealedPointer;
}

export { bytesToHex, hexToBytes };
