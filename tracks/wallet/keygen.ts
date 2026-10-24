// Make a new Solana devnet wallet for the box. Prints the vault line and the address to fund.
//   node --experimental-strip-types tracks/wallet/keygen.ts
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getBase58Decoder } from '@solana/kit';

/** A Solana keypair as base58: the 64-byte secret (seed, then public key) and the address. */
export function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const b58 = getBase58Decoder();
  return { secret: b58.decode(Buffer.concat([seed, pub])), address: b58.decode(pub) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const k = newKey();
  console.log(`WALLET_SOLANA_KEY=${k.secret}`);
  console.error(`address to fund with devnet USDC: ${k.address}`);
}
