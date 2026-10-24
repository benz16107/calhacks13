// The demo inbox: a small POP3 mail server on the box holding sample receipts we wrote, standing in for a
// household's Gmail (we cannot make a Gmail account for the demo). Its login is in the vault. The shopper's
// receipts tool logs in from the core and hands the agent the receipts only: never the login, never other mail.
import net from 'node:net';

export const MAILBOX = 'household@box.test';
const DAY = 86_400_000;

// Each item's purchase days, in days before now. Filters and paper towels run out within the week; the rest do not.
const BOUGHT: Record<string, { name: string; priceCents: number; days: number[] }> = {
  'HV60-100': { name: 'Hario V60 02 paper filters, 100 count', priceCents: 899, days: [88, 58, 29] },
  'PT-6': { name: 'Paper towels, 6 rolls', priceCents: 1149, days: [38, 25, 12] },
  'DS-750': { name: 'Dish soap, 750 ml', priceCents: 399, days: [58, 25] },
  'CB-340': { name: 'Whole bean coffee, 340 g', priceCents: 1600, days: [27, 14, 1] },
  'USBC-1M': { name: 'USB-C cable, 1 m', priceCents: 999, days: [45] },
};

const header = (from: string, subject: string, date: Date, id: string) =>
  `From: ${from}\r\nTo: ${MAILBOX}\r\nSubject: ${subject}\r\nDate: ${date.toUTCString()}\r\nMessage-ID: <${id}@box.test>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n`;

/** The sample mailbox as RFC 5322 messages, dated relative to `now`: one receipt per shopping day, plus two other emails. */
export function sampleMail(now = Date.now()): string[] {
  const byDay = new Map<number, string[]>();
  for (const [sku, b] of Object.entries(BOUGHT)) for (const d of b.days) byDay.set(d, [...(byDay.get(d) ?? []), sku]);
  let order = 1040;
  const receipts = [...byDay.entries()].sort((a, b) => b[0] - a[0]).map(([d, skus]) => {
    const lines = skus.map((sku) => `1 x ${BOUGHT[sku].name} (${sku}) @ $${(BOUGHT[sku].priceCents / 100).toFixed(2)}`);
    const total = skus.reduce((s, sku) => s + BOUGHT[sku].priceCents, 0);
    return header('Box Test Store <receipts@store.box.test>', `Your Box Test Store receipt, order ${++order}`, new Date(now - d * DAY), `r${order}`) +
      `Thanks for your order.\r\n\r\n${lines.join('\r\n')}\r\n\r\nTotal: $${(total / 100).toFixed(2)}\r\nSample receipt in the demo inbox.\r\n`;
  });
  return [
    ...receipts,
    header('Credit Union <alerts@bank.box.test>', 'Your October statement is ready', new Date(now - 3 * DAY), 'bank') + 'Your statement is ready to view. Balance: $2,481.07.\r\n',
    header('Mail <no-reply@mail.box.test>', 'Your sign-in code', new Date(now - 2 * DAY), 'code') + 'Your sign-in code is 482913. It expires in 10 minutes.\r\n',
  ];
}

// ---------- POP3 (RFC 1939): the server ----------

/** Serve `messages` over POP3 on 127.0.0.1. `login` checks a user and password (against the vault). */
export function startInbox(messages: string[], login: (user: string, pass: string) => Promise<boolean>): Promise<{ port: number; close: () => void }> {
  const server = net.createServer((sock) => {
    let user = '';
    let authed = false;
    let buf = '';
    let queue: Promise<unknown> = Promise.resolve();
    const send = (s: string) => sock.write(s + '\r\n');
    const handle = async (line: string) => {
      const [cmd = '', ...rest] = line.split(' ');
      const arg = rest.join(' ');
      switch (cmd.toUpperCase()) {
        case 'CAPA':
          return send('+OK\r\nUSER\r\n.');
        case 'USER':
          user = arg;
          return send('+OK');
        case 'PASS':
          authed = await login(user, arg).catch(() => false);
          return send(authed ? `+OK ${messages.length} messages` : '-ERR wrong user or password');
        case 'QUIT':
          send('+OK bye');
          return void sock.end();
        case 'NOOP':
          return send('+OK');
      }
      if (!authed) return send('-ERR log in first');
      const size = (m: string) => Buffer.byteLength(m);
      if (cmd.toUpperCase() === 'STAT') return send(`+OK ${messages.length} ${messages.reduce((s, m) => s + size(m), 0)}`);
      if (cmd.toUpperCase() === 'LIST') return send(`+OK\r\n${messages.map((m, i) => `${i + 1} ${size(m)}`).join('\r\n')}${messages.length ? '\r\n' : ''}.`);
      if (cmd.toUpperCase() === 'RETR') {
        const m = messages[Number(arg) - 1];
        if (!m) return send('-ERR no such message');
        return send(`+OK ${size(m)}\r\n${m.replace(/\r\n$/, '').replace(/^\./gm, '..')}\r\n.`);
      }
      send('-ERR unknown command');
    };
    sock.setEncoding('utf8');
    sock.on('error', () => {});
    sock.on('data', (chunk: string) => {
      buf += chunk;
      if (buf.length > 10_000) return void sock.destroy();
      let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        queue = queue.then(() => handle(line));
      }
    });
    send('+OK demo inbox ready');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as net.AddressInfo).port, close: () => server.close() })),
  );
}

// ---------- POP3: the client ----------

/** Log in and download every message. Throws on a wrong login. */
export function fetchMail(port: number, user: string, pass: string, host = '127.0.0.1'): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, host);
    sock.setEncoding('utf8');
    sock.setTimeout(10_000, () => sock.destroy(new Error('the mail server did not answer')));
    let buf = '';
    let want: { multi: boolean; done: (text: string) => void } | undefined;
    const pump = () => {
      if (!want) return;
      const end = want.multi ? buf.indexOf('\r\n.\r\n') : buf.indexOf('\r\n');
      const errLine = buf.startsWith('-ERR') ? buf.indexOf('\r\n') : -1;
      if (errLine >= 0) return sock.destroy(new Error(`mail server: ${buf.slice(5, errLine)}`));
      if (end < 0) return;
      const text = buf.slice(0, end);
      buf = buf.slice(end + (want.multi ? 5 : 2));
      const w = want;
      want = undefined;
      w.done(text);
    };
    const cmd = (line: string | null, multi = false) =>
      new Promise<string>((done) => {
        want = { multi, done };
        if (line) sock.write(line + '\r\n');
        pump();
      });
    sock.on('data', (c: string) => ((buf += c), pump()));
    sock.on('error', reject);
    (async () => {
      await cmd(null);
      await cmd(`USER ${user}`);
      await cmd(`PASS ${pass}`);
      const count = Number((await cmd('STAT')).split(' ')[1]);
      const out: string[] = [];
      for (let n = 1; n <= count; n++) out.push((await cmd(`RETR ${n}`, true)).split('\r\n').slice(1).join('\r\n').replace(/^\.\./gm, '.'));
      await cmd('QUIT');
      sock.end();
      resolve(out);
    })().catch((e) => (sock.destroy(), reject(e)));
  });
}

// ---------- receipts and what is running low ----------

export type Item = { sku: string; name: string; qty: number; priceCents: number };
export type Receipt = { date: string; from: string; subject: string; items: Item[] };
export type Estimate = { sku: string; name: string; boughtTimes: number; lastBought: string; everyDays: number; daysLeft: number; runningLow: boolean; lastQty: number };

export function parseMessage(raw: string) {
  const [head, ...rest] = raw.split('\r\n\r\n');
  const headers = Object.fromEntries(head.split('\r\n').map((l) => [l.slice(0, l.indexOf(':')).toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
  return { headers, body: rest.join('\r\n\r\n') };
}

const LINE = /^(\d+) x (.+) \(([\w-]+)\) @ \$(\d+\.\d\d)$/gm;

/** Keep the receipts, count the rest, and work out when each regular item runs out. */
export function readReceipts(raws: string[], now = Date.now()) {
  const receipts: Receipt[] = [];
  let withheld = 0;
  for (const raw of raws) {
    const { headers, body } = parseMessage(raw);
    const items = [...body.matchAll(LINE)].map(([, qty, name, sku, price]) => ({ sku, name, qty: Number(qty), priceCents: Math.round(Number(price) * 100) }));
    if (!/receipt|order/i.test(headers.subject ?? '') || !items.length) {
      withheld++;
      continue;
    }
    receipts.push({ date: new Date(headers.date).toISOString(), from: headers.from, subject: headers.subject, items });
  }
  return { receipts, withheld, estimates: estimate(receipts, now) };
}

// shortcut: assumes each purchase lasts until the next one, whatever the quantity; enough for a household's regulars.
export function estimate(receipts: Receipt[], now = Date.now()): Estimate[] {
  const bySku = new Map<string, { name: string; buys: { at: number; qty: number }[] }>();
  for (const r of receipts) for (const i of r.items) {
    const e = bySku.get(i.sku) ?? { name: i.name, buys: [] };
    e.buys.push({ at: Date.parse(r.date), qty: i.qty });
    bySku.set(i.sku, e);
  }
  const out: Estimate[] = [];
  for (const [sku, { name, buys }] of bySku) {
    if (buys.length < 2) continue; // bought once: not a regular
    buys.sort((a, b) => a.at - b.at);
    const every = (buys.at(-1)!.at - buys[0].at) / (buys.length - 1);
    const daysLeft = Math.round((buys.at(-1)!.at + every - now) / DAY);
    out.push({ sku, name, boughtTimes: buys.length, lastBought: new Date(buys.at(-1)!.at).toISOString().slice(0, 10), everyDays: Math.round(every / DAY), daysLeft, runningLow: daysLeft <= 7, lastQty: buys.at(-1)!.qty });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
