// An in-memory stand-in for Object Storage, for the unit test and the demo: it speaks the five calls s3.ts makes and
// checks that each request carries a SigV4 Authorization for the access key it was started with. It is not Vultr.
import http from 'node:http';

export function fakeS3(access: string): Promise<{ url: string; objects: Map<string, Buffer>; close(): void }> {
  const objects = new Map<string, Buffer>();
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c);
    if (!req.headers.authorization?.includes(`Credential=${access}/`) || !req.headers['x-amz-content-sha256'] || !req.headers['x-amz-date']) return void res.writeHead(403).end('<Error>SignatureDoesNotMatch</Error>');
    const u = new URL(req.url!, 'http://x');
    const [, bucket, ...rest] = decodeURIComponent(u.pathname).split('/');
    const key = rest.join('/');
    if (!key && req.method === 'HEAD') return void res.writeHead(200).end();
    if (!key && req.method === 'GET') {
      const prefix = u.searchParams.get('prefix') ?? '';
      const items = [...objects].filter(([k]) => k.startsWith(`${bucket}/${prefix}`)).map(([k, v]) => `<Contents><Key>${k.slice(bucket.length + 1)}</Key><Size>${v.length}</Size><LastModified>2026-10-24T00:00:00.000Z</LastModified></Contents>`);
      return void res.writeHead(200).end(`<ListBucketResult>${items.join('')}</ListBucketResult>`);
    }
    if (req.method === 'PUT') objects.set(`${bucket}/${key}`, Buffer.concat(chunks));
    if (req.method === 'DELETE') objects.delete(`${bucket}/${key}`);
    if (req.method === 'GET') {
      const body = objects.get(`${bucket}/${key}`);
      return void (body ? res.writeHead(200).end(body) : res.writeHead(404).end('<Error>NoSuchKey</Error>'));
    }
    res.writeHead(200).end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, objects, close: () => server.close() })));
}
