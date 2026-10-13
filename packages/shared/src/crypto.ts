import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2b";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, type Hex } from "viem";

/**
 * Access credentials travel only as a libsodium-compatible sealed box to the holder's
 * X25519 key, inside the AccessPosted event. The holder's key is derived from a wallet
 * signature, so it is never stored and the same wallet recovers it on any device.
 */

export const ACCESS_KEY_MESSAGE =
  "Silica access key v1\n\nSigning derives the key that decrypts your GPU access credentials. It never leaves this browser and costs no gas.";

export function keyPairFromSignature(signature: Hex) {
  const seed = sha256(hexToBytes(signature));
  const kp = nacl.box.keyPair.fromSecretKey(seed);
  return { publicKey: bytesToHex(kp.publicKey) as Hex, secretKey: kp.secretKey };
}

const sealNonce = (epk: Uint8Array, pk: Uint8Array) => {
  const b = new Uint8Array(64);
  b.set(epk);
  b.set(pk, 32);
  return blake2b(b, { dkLen: nacl.box.nonceLength });
};

/** crypto_box_seal: ephemeral pk || box(message) */
export function sealTo(recipientPublicKey: Hex, message: string): Hex {
  const pk = hexToBytes(recipientPublicKey);
  const eph = nacl.box.keyPair();
  const boxed = nacl.box(new TextEncoder().encode(message), sealNonce(eph.publicKey, pk), pk, eph.secretKey);
  const out = new Uint8Array(32 + boxed.length);
  out.set(eph.publicKey);
  out.set(boxed, 32);
  return bytesToHex(out);
}

/** crypto_box_seal_open */
export function openSealed(ciphertext: Hex, secretKey: Uint8Array): string | null {
  const c = hexToBytes(ciphertext);
  if (c.length < 32 + nacl.box.overheadLength) return null;
  const epk = c.slice(0, 32);
  const pk = nacl.box.keyPair.fromSecretKey(secretKey).publicKey;
  const opened = nacl.box.open(c.slice(32), sealNonce(epk, pk), epk, secretKey);
  return opened ? new TextDecoder().decode(opened) : null;
}
