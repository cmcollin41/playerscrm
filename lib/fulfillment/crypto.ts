/**
 * AES-256-GCM symmetric encryption for fulfillment-partner credentials.
 *
 * `PLATFORM_ENCRYPTION_KEY` is a base64-encoded 32-byte key (256 bits)
 * stored in the deployment environment. Each ciphertext is a concatenation
 * of: 12-byte random IV ‖ ciphertext ‖ 16-byte GCM auth tag.
 *
 * Generate a fresh key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Rotation: change PLATFORM_ENCRYPTION_KEY, then re-encrypt all
 * account_partner_connections.credentials_encrypted blobs via a one-off
 * migration script using both old and new keys in sequence. Out of scope
 * for MVP.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"
import type { ConnectionCredentials } from "./types"

const IV_LEN = 12
const TAG_LEN = 16

function loadKey(): Buffer {
  const b64 = process.env.PLATFORM_ENCRYPTION_KEY
  if (!b64) {
    throw new Error(
      "PLATFORM_ENCRYPTION_KEY is not set. Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` and add to .env.local + Vercel env.",
    )
  }
  const key = Buffer.from(b64, "base64")
  if (key.length !== 32) {
    throw new Error(
      `PLATFORM_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Regenerate with the snippet in lib/fulfillment/crypto.ts.`,
    )
  }
  return key
}

/**
 * Encrypt a credential payload to a single bytea blob.
 * Returns: IV ‖ ciphertext ‖ tag — store this as `bytea` directly.
 */
export function encryptCredentials(payload: ConnectionCredentials): Buffer {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv)
  const json = Buffer.from(JSON.stringify(payload), "utf8")
  const enc = Buffer.concat([cipher.update(json), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, enc, tag])
}

export function decryptCredentials(blob: Buffer): ConnectionCredentials {
  if (blob.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Ciphertext too short — credentials blob is corrupt.")
  }
  const iv = blob.subarray(0, IV_LEN)
  const tag = blob.subarray(blob.length - TAG_LEN)
  const ct = blob.subarray(IV_LEN, blob.length - TAG_LEN)
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(plain.toString("utf8")) as ConnectionCredentials
}
