// What an agent harness does after a command: record its output as a step in the task's log (the broker, over BOX_SOCKET).
import fs from 'node:fs';
import http from 'node:http';

const text = fs.readFileSync('project/postinstall-report.json', 'utf8');
const body = JSON.stringify({ text: 'npm install finished; its postinstall reported: ' + JSON.stringify(JSON.parse(text).map((r) => `${r.step}:${r.outcome}`)) });
await new Promise((resolve, reject) => {
  const req = http.request({ socketPath: process.env.BOX_SOCKET, path: '/step', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => (res.resume(), res.on('end', resolve)));
  req.on('error', reject);
  req.end(body);
});
