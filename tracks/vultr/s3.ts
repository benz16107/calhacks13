// A small S3 client for Vultr Object Storage: AWS Signature V4, path-style URLs, the five calls backups need.
// No package: Node has fetch, fs.openAsBlob and crypto.
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';

export interface S3Config {
  /** 'sjc1.vultrobjects.com', or a full 'http://127.0.0.1:9000' (the demo's local stand-in). */
  host: string;
  bucket: string;
  access: string;
  secret: string;
  region?: string;
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();
// RFC 3986 encoding, as SigV4 wants it (encodeURIComponent leaves !'()* alone).
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** The Authorization header for one request. `headers` are the ones to sign; host and x-amz-* must be among them. */
export function sign(method: string, path: string, query: Record<string, string>, headers: Record<string, string>, payloadHash: string, amzDate: string, cfg: Pick<S3Config, 'access' | 'secret' | 'region'>): string {
  const region = cfg.region ?? 'us-east-1';
  const day = amzDate.slice(0, 8);
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim()]));
  const canonical = [
    method,
    path.split('/').map(enc).join('/'),
    Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&'),
    names.map((h) => `${h}:${lower[h]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + cfg.secret, day), region), 's3'), 'aws4_request');
  return `AWS4-HMAC-SHA256 Credential=${cfg.access}/${scope}, SignedHeaders=${names.join(';')}, Signature=${createHmac('sha256', key).update(toSign).digest('hex')}`;
}

async function call(cfg: S3Config, method: string, key: string, opts: { query?: Record<string, string>; body?: Blob; payloadHash?: string } = {}): Promise<Response> {
  const base = cfg.host.includes('://') ? cfg.host : `https://${cfg.host}`;
  const url = new URL(base);
  const path = `/${cfg.bucket}${key ? '/' + key : ''}`;
  const query = opts.query ?? {};
  const payloadHash = opts.payloadHash ?? sha256('');
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  headers.authorization = sign(method, path, query, headers, payloadHash, amzDate, cfg);
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${url.origin}${path.split('/').map(enc).join('/')}${qs ? '?' + qs : ''}`, { method, headers, body: opts.body });
  return res;
}

const fail = async (what: string, res: Response) => {
  throw new Error(`${what}: Object Storage said ${res.status} ${(await res.text()).replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`);
};

/** Make the bucket (private) if it is not there. */
export async function ensureBucket(cfg: S3Config): Promise<void> {
  const head = await call(cfg, 'HEAD', '');
  if (head.ok) return;
  const res = await call(cfg, 'PUT', '');
  if (!res.ok && res.status !== 409) await fail('making the bucket', res);
}

/** Upload one file. It is hashed first, because SigV4 signs the body. */
export async function putFile(cfg: S3Config, key: string, file: string): Promise<void> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  const res = await call(cfg, 'PUT', key, { body: await fs.openAsBlob(file), payloadHash: hash.digest('hex') });
  if (!res.ok) await fail(`uploading ${key}`, res);
}

export async function getFile(cfg: S3Config, key: string, file: string): Promise<void> {
  const res = await call(cfg, 'GET', key);
  if (!res.ok || !res.body) await fail(`downloading ${key}`, res);
  await fs.promises.writeFile(file, res.body as unknown as AsyncIterable<Uint8Array>);
}

export async function remove(cfg: S3Config, key: string): Promise<void> {
  const res = await call(cfg, 'DELETE', key);
  if (!res.ok && res.status !== 404) await fail(`deleting ${key}`, res);
}

export interface Listed {
  key: string;
  size: number;
  at: string;
}

/** Every object under a prefix, oldest first. Follows continuation, 1000 at a time. */
export async function list(cfg: S3Config, prefix: string): Promise<Listed[]> {
  const out: Listed[] = [];
  let token = '';
  do {
    const res = await call(cfg, 'GET', '', { query: { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) } });
    if (!res.ok) await fail('listing backups', res);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const field = (n: string) => m[1].match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1] ?? '';
      out.push({ key: field('Key'), size: Number(field('Size')), at: field('LastModified') });
    }
    token = xml.match(/<NextContinuationToken>([^<]*)</)?.[1] ?? '';
  } while (token);
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
