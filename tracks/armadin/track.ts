import type { Track } from '../../core/contract.ts';

// Armadin: attacks on agents (a poisoned package, a hijacked payment, an OS-level scoreboard), run by demo.ts.
// It has no tools or routes of its own: the point is that the core's controls stop the attacks.
const track: Track = {
  name: 'armadin',
  title: 'Attack tests',
  description: "Known attacks on AI agents, like a poisoned package or a hijacked payment, that GurtOS is tested against. They run only in GurtOS's own test suite, never on this computer; the results are in its published attack scoreboard.",
};
export default track;
