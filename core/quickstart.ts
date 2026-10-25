// Quick Start: set up a new GurtOS computer from one you already own, with your phone as the bridge.
//
// The new computer (the target) shows a QR: a rendezvous id, its one-time X25519 public key and a 128-bit secret,
// all after `#`, so no server sees them. The phone scans it, makes its own one-time key, and asks a computer it is
// paired with as the owner (the source) to send. The source asks the owner to approve exactly what leaves, then
// seals it in core (never in a task) to the target's key mixed with the secret, and drops it in the relay's
// rendezvous slot. The target opens it in its own core and applies it with the same setup functions as the wizard
// and command setup, turns remote access on, and seals an owner pairing code to the phone. The relay sees only
// ciphertext and a random id; it can't read or swap anything without the secret.
import { createCipheriv, createDecipheriv, createHash, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, type KeyObject } from 'node:crypto';

const INFO = 'gurtos quickstart v1';
const WORDS = ('maple river stone cloud ember harbor willow meadow cedar falcon orbit lantern copper prairie coral '
  + 'thistle summit canyon breeze pebble aspen glacier harvest juniper mosaic nectar quartz saffron tundra velvet '
  + 'walnut zephyr amber birch comet dune fern grove heron iris jasper kettle lilac moss nova olive pine quill raven '
  + 'sage tide umber vine wren yarrow acorn bloom crest delta echo frost gale haze').split(' ');

/** Four words from the target's key, shown on the new computer and in the owner's approval, to compare. */
export function phrase(pk: string): string {
  const h = createHash('sha256').update(pk).digest();
  return [0, 1, 2, 3].map((i) => WORDS[h[i] % WORDS.length]).join(' ');
}

export const fingerprint = (pk: string) => createHash('sha256').update(pk).digest('hex').slice(0, 16);

export function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  return { privateKey, pk: (publicKey.export({ format: 'jwk' }) as { x: string }).x };
}

const publicKey = (x: string) => createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x }, format: 'jwk' });
const aesKey = (shared: Buffer, s: string) => Buffer.from(hkdfSync('sha256', shared, Buffer.from(s, 'base64url'), INFO, 32));

export interface Sealed { v: 1; eph: string; iv: string; ct: string }

/** Seal JSON to an X25519 public key, mixing in the QR's secret: X25519, HKDF-SHA256, AES-256-GCM. */
export function seal(toPk: string, s: string, data: unknown): Sealed {
  const eph = generateKeyPairSync('x25519');
  const key = aesKey(diffieHellman({ privateKey: eph.privateKey, publicKey: publicKey(toPk) }), s);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(data)), c.final(), c.getAuthTag()]);
  return { v: 1, eph: (eph.publicKey.export({ format: 'jwk' }) as { x: string }).x, iv: iv.toString('base64url'), ct: ct.toString('base64url') };
}

/** Open a sealed box with the private key and the QR's secret. Throws if anything was changed. */
export function open(privateKey: KeyObject, s: string, b: Sealed): any {
  if (b?.v !== 1) throw new Error('not a Quick Start bundle');
  const key = aesKey(diffieHellman({ privateKey, publicKey: publicKey(b.eph) }), s);
  const ct = Buffer.from(b.ct, 'base64url');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(b.iv, 'base64url'));
  d.setAuthTag(ct.subarray(-16));
  return JSON.parse(Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]).toString());
}

/** Settings a new computer takes from the source. Not `paused` (that takes a person), not `agentFolders` (paths differ). */
export const COPIED_SETTINGS = ['approvalThresholdCents', 'defaultBudgetCents', 'watchLimitCents', 'networkDefault', 'defaultHosts', 'quietHours', 'logRetentionDays', 'updateChannel', 'autoUpdate', 'appearance'];
export const MODEL_KEYS = ['FACTORY_API_KEY', 'ANTHROPIC_API_KEY'];
const label = (k: string) => (k === 'ANTHROPIC_API_KEY' ? 'Anthropic key' : k === 'FACTORY_API_KEY' ? 'Factory key' : k);

/** What a phone sent to start a Quick Start, checked at the trust boundary. */
export function parseSend(b: any) {
  const id = (v: unknown, min: number, max: number) => typeof v === 'string' && new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`).test(v);
  if (!id(b?.rv, 22, 64)) throw new Error('rv: the rendezvous id from the QR');
  if (!id(b.pk, 43, 43)) throw new Error("pk: the new computer's public key from the QR");
  if (!id(b.s, 22, 43)) throw new Error('s: the secret from the QR');
  if (!id(b.phonePk, 43, 43)) throw new Error("phonePk: this phone's one-time public key");
  const n = typeof b.n === 'string' && b.n.trim() ? b.n.trim().slice(0, 40) : 'the new computer';
  return { rv: b.rv as string, pk: b.pk as string, s: b.s as string, phonePk: b.phonePk as string, n };
}

/** The approval's sentence: exactly what leaves, to where, with the phrase to compare. */
export function question(o: { keys: string[]; apps: number; n: string; pk: string }) {
  const apps = `${o.apps} app${o.apps === 1 ? '' : 's'}`;
  const what = o.keys.length ? `your ${o.keys.map(label).join(', ')}, ${apps} and your spending rules` : `${apps} and your spending rules (no keys)`;
  return `Send ${what} to "${o.n}" (check phrase: ${phrase(o.pk)})?`;
}

export interface Apply {
  putKey(name: string, value: unknown, who?: any): Promise<unknown>;
  changeSettings(patch: Record<string, unknown>, who?: any): unknown;
  enableApp(id: string): Promise<unknown>;
  disableApp(id: string): Promise<unknown>;
  setupStep(kind: 'step' | 'finish' | 'reopen', step?: string, data?: unknown): unknown;
}

export interface TargetDeps {
  relay: string;
  app: string;
  apply: Apply;
  /** Installed apps here, and whether each is on. */
  apps(): { id: string; on: boolean }[];
  /** Turn remote access on (a name from the box id) and resolve with the https host once it answers. */
  remoteOn(): Promise<string>;
  /** A one-time owner pairing code. */
  ownerCode(): string;
  note(text: string, data?: unknown): void;
}

type Step = { text: string; ok: boolean; at: string };

/** The new computer's side: one session at a time, ten minutes, Stop at any point. */
export class Target {
  deps: TargetDeps;
  state: 'off' | 'waiting' | 'applying' | 'done' | 'stopped' | 'error' = 'off';
  steps: Step[] = [];
  error?: string;
  rv = '';
  s = '';
  pk = '';
  privateKey?: KeyObject;
  abort?: AbortController;
  until = 0;
  constructor(deps: TargetDeps) {
    this.deps = deps;
  }

  view() {
    return { state: this.state, ...(this.pk ? { phrase: phrase(this.pk) } : {}), steps: this.steps, ...(this.error ? { error: this.error } : {}), ...(this.until ? { expiresAt: new Date(this.until).toISOString() } : {}) };
  }

  start(name: string) {
    this.abort?.abort();
    const { privateKey, pk } = keyPair();
    Object.assign(this, { privateKey, pk, rv: randomBytes(16).toString('base64url'), s: randomBytes(16).toString('base64url'), state: 'waiting', steps: [], error: undefined, until: Date.now() + 10 * 60_000 });
    this.abort = new AbortController();
    const frag = Object.entries({ rv: this.rv, pk, s: this.s, n: name }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    void this.watch(this.abort.signal);
    return { url: `${this.deps.app}/quickstart#${frag}`, ...this.view() };
  }

  async stop() {
    if (this.state !== 'waiting' && this.state !== 'applying') return this.view();
    this.abort?.abort();
    this.state = 'stopped';
    // Fill the bundle slot, so a bundle that arrives late is refused at the relay (slots are write-once).
    await fetch(`${this.deps.relay}/v1/rv/${this.rv}/bundle`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"stopped":true}', signal: AbortSignal.timeout(10_000) }).catch(() => {});
    this.deps.note('Quick Start stopped on this computer');
    return this.view();
  }

  async watch(signal: AbortSignal) {
    while (!signal.aborted && Date.now() < this.until) {
      try {
        const r = await fetch(`${this.deps.relay}/v1/rv/${this.rv}/bundle?wait=25`, { signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]) });
        if (r.status === 404) continue;
        if (!r.ok) throw new Error(`relay answered ${r.status}`);
        const b = await r.json();
        if ((b as { stopped?: boolean }).stopped) return;
        await this.apply(open(this.privateKey!, this.s, b as Sealed));
        return;
      } catch (e) {
        if (signal.aborted) return;
        this.state = 'error';
        this.error = (e as Error).message;
        this.deps.note(`Quick Start failed: ${this.error}`);
        return;
      }
    }
    if (this.state === 'waiting') (this.state = 'error'), (this.error = 'Nothing arrived in 10 minutes. Start Quick Start again.');
  }

  /** Apply a bundle with the same setup functions as the wizard and command setup. Stops between steps if asked. */
  async apply(b: { from: string; keys: Record<string, string>; settings: Record<string, unknown>; apps: string[]; phonePk: string }) {
    this.state = 'applying';
    const who = { by: `Quick Start from ${b.from}` };
    const step = (text: string) => {
      if (this.abort?.signal.aborted) throw new Error('stopped');
      this.steps.push({ text, ok: true, at: new Date().toISOString() });
      this.deps.note(`Quick Start: ${text}`);
    };
    for (const [name, value] of Object.entries(b.keys ?? {})) {
      await this.deps.apply.putKey(name, value, who);
      step(`${label(name)} added (from ${b.from})`);
    }
    const patch = Object.fromEntries(Object.entries(b.settings ?? {}).filter(([k]) => COPIED_SETTINGS.includes(k)));
    if (Object.keys(patch).length) this.deps.apply.changeSettings(patch, who), step('Spending rules, quiet hours and appearance copied');
    const want = new Set(b.apps ?? []);
    let on = 0;
    for (const a of this.deps.apps()) {
      if (want.has(a.id) && !a.on) await this.deps.apply.enableApp(a.id);
      else if (!want.has(a.id) && a.on) await this.deps.apply.disableApp(a.id);
      if (want.has(a.id)) on++;
    }
    step(`${on} app${on === 1 ? '' : 's'} on, as on ${b.from}`);
    const host = await this.deps.remoteOn();
    step(`Reach from anywhere: ${host}`);
    const sealed = seal(b.phonePk, this.s, { host, code: this.deps.ownerCode() });
    const r = await fetch(`${this.deps.relay}/v1/rv/${this.rv}/owner`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sealed), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`relay answered ${r.status} for the phone's pairing code`);
    step('Your phone can pair now');
    this.deps.apply.setupStep('step', 'quickstart', { from: b.from });
    this.state = 'done';
  }
}

/** The source's side: a send waits for the owner's named OK, then core seals and drops it. */
export interface Pending { rv: string; pk: string; s: string; phonePk: string; n: string; keys: string[]; at: number; by: string }

export function bundle(o: { from: string; keys: Record<string, string>; settings: Record<string, unknown>; apps: string[]; phonePk: string }) {
  return { from: o.from, keys: o.keys, settings: Object.fromEntries(Object.entries(o.settings).filter(([k]) => COPIED_SETTINGS.includes(k))), apps: o.apps, phonePk: o.phonePk };
}

/** Seal a bundle to the target and drop it at the relay. 409: the new computer stopped, or something already arrived. */
export async function deliver(relay: string, p: Pending, b: ReturnType<typeof bundle>) {
  const r = await fetch(`${relay}/v1/rv/${p.rv}/bundle`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(seal(p.pk, p.s, b)), signal: AbortSignal.timeout(15_000) });
  if (r.status === 409) throw Object.assign(new Error(`${p.n} stopped Quick Start, or already got a bundle`), { status: 409 });
  if (!r.ok) throw Object.assign(new Error(`the relay answered ${r.status}`), { status: 502 });
}
