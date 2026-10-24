import type { Track } from '../../core/contract.ts';

// Armadin: attacks on agents (a poisoned package, a hijacked payment, an OS-level scoreboard), run by demo.ts.
// It has no tools or routes of its own: the point is that the core's controls stop the attacks.
const track: Track = {
  name: 'armadin',
  title: 'Attacks on agents',
  description: 'A poisoned npm package, a hijacked supplier payment and a scoreboard of OS-level attacks, each run against a real box with the result published, caught or missed.',
};
export default track;
