import type { Track } from '../../core/contract.ts';

// Armadin: attacks on agents (a poisoned package, a hijacked payment, an OS-level scoreboard), run by demo.ts.
// It has no tools or routes of its own: the point is that the core's controls stop the attacks.
const track: Track = {
  name: 'armadin',
  title: 'Attack tests',
  description: 'Runs known attacks on AI agents against this computer, like a poisoned package or a hijacked payment, and shows which ones GurtOS stopped.',
};
export default track;
