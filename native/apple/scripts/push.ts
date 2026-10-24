// Make the APNs payload the relay will send for one approval, encrypted and signed exactly as a box does
// (core/push.ts), for the subscription a device gave that box. For simulator checks: `xcrun simctl push`.
//   node native/apple/scripts/push.ts '<device JSON from devices.json>' '<approval JSON>' 'Home box' native https://... > push.apns
import { approvalText, encrypt, message } from '../../../core/push.ts';

const [device, approval, box, machine, url, source = ''] = process.argv.slice(2);
const d = JSON.parse(device);
const a = JSON.parse(approval);
const fields = { v: 1, type: 'approval', machine, box, url, id: a.id, task: a.task, source, costCents: a.costCents, ...approvalText(a, process.argv[8] ?? '') };
const e = encrypt(d.push.p256dh, d.push.auth, Buffer.from(message(fields, d.push.key))).toString('base64url');
console.log(JSON.stringify({ 'Simulator Target Bundle': 'com.benzhou.gurtos', aps: { alert: { title: 'GurtOS', body: 'A request needs you' }, 'mutable-content': 1, category: 'APPROVAL', sound: 'default' }, e }));
