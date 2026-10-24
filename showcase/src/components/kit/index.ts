// Everything a track page can use without importing it: the page's MDX gets these as components (see pages/tracks/[slug].astro).
import Lead from './Lead.astro';
import Shot from './Shot.astro';
import Clip from './Clip.astro';
import Compare from './Compare.astro';
import CriteriaMap from './CriteriaMap.astro';
import Details from './Details.astro';
import OSvsTrack from './OSvsTrack.astro';
import Steps from './Steps.astro';
import Evidence from './Evidence.astro';
import Limits from './Limits.astro';
import Numbers from './Numbers.astro';
import Sources from './Sources.astro';
import Flow from '../Flow.astro';
import Status from '../Status.astro';
import LinkList from '../LinkList.astro';
import VideoSlot from '../VideoSlot.astro';

export const kit = { Lead, Shot, Clip, Compare, CriteriaMap, Details, OSvsTrack, Steps, Evidence, Limits, Numbers, Sources, Flow, Status, LinkList, Video: VideoSlot };
