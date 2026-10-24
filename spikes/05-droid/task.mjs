// Spike 5: what runs as the task user. One small task through the Droid SDK, in the task's own copy.
import { run, listModels } from '@factory/droid-sdk/node';

if (process.env.LIST_MODELS) for (const m of await listModels()) console.log('model', m.id);
const t0 = Date.now();
const result = await run(
  'Create a file named hello.txt containing exactly the line "hi from droid". Then append a line "checked" to README.md. Do nothing else.',
  { cwd: process.cwd(), modelId: process.env.DROID_MODEL ?? 'claude-opus-5-5', autonomyLevel: 'low' },
);
console.log(JSON.stringify({ seconds: (Date.now() - t0) / 1000, success: result.success, subtype: result.subtype,
  text: result.text?.slice(0, 300), error: result.error?.message }));
