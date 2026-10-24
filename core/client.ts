// JSON over HTTP on a Unix socket. Workers use it to reach their broker; the demo uses it to reach the box.
import http from 'node:http';

export function call<T = any>(socketPath: string, method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, method, path, headers: { 'content-type': 'application/json' } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        const data = text ? JSON.parse(text) : undefined;
        if ((res.statusCode ?? 500) >= 400) reject(new Error(data?.error ?? `HTTP ${res.statusCode}`));
        else resolve(data);
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
