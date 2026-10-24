// Writes one Code Connect template per Figma icon and app icon, so other templates can read an icon's name
// (metadata.props.name) from its own template. Run: node docs/figma/code-connect/gen-icons.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../../../', import.meta.url).pathname;
const URL_BASE = 'https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=';
// Figma component ids on the page "GurtOS system" (icon/<name>, app/<id>), read with use_figma.
const ICONS = 'applications-science 47:3383, avatar-default 47:3386, computer 47:3389, dialog-information 47:3392, dialog-password 47:3395, dialog-warning 47:3398, document-open-recent 47:3401, emblem-system 47:3404, folder 47:3407, go-next 47:3410, go-previous 47:3413, help-about 47:3416, list-add 47:3419, list-remove 47:3422, media-playback-pause 47:3425, media-playback-start 47:3428, network-server 47:3431, network-wired 47:3434, network-wireless-signal-excellent 47:3437, object-select 47:3440, open-menu 47:3443, pan-down 47:3446, pan-end 47:3449, phone 47:3452, preferences-desktop-accessibility 47:3455, preferences-desktop-apps 47:3458, preferences-desktop-display 47:3461, preferences-desktop-keyboard 47:3464, preferences-desktop-locale 47:3467, preferences-system-details 47:3470, preferences-system-network 47:3473, preferences-system-notifications 47:3476, preferences-system-privacy 47:3479, preferences-system-time 47:3482, process-stop 47:3485, security-high 47:3488, sidebar-show 47:3491, software-update-available 47:3494, system-lock-screen 47:3497, system-search 47:3500, system-shutdown 47:3503, user-home 47:3506, user-trash 47:3509, utilities-terminal 47:3512, view-app-grid 47:3515, view-more 47:3518, weather-clear-night 47:3521, web-browser 47:3524, window-close 47:3527, window-maximize 47:3530, window-minimize 47:3533, airplane-mode 99:11383, applets-screenshooter 99:11386, audio-volume-high 99:11389, bluetooth 99:11392, display-brightness 99:11395, night-light 99:11398, power-profile-balanced 99:11401';
const APPS = 'tasks 48:93, activity 48:99, time-machine 48:109, settings 48:119, app-center 48:131, credit-desk 48:139, shopper 48:147, wallet 48:155, find 48:163, jira 48:173, asi-one 48:181, elastic 69:196, mana 69:205, web 78:226';

const kitIcons = new Set(Object.keys(JSON.parse(readFileSync(root + 'portal/src/kit/icons.ts', 'utf8').match(/=\s*(\{[\s\S]*?\});/)![1])));
const kitApps = new Set([...readFileSync(root + 'portal/src/kit/ui.tsx', 'utf8').matchAll(/^\s+'?([a-z-]+)'?:\s*\{\s*glyph/gm)].map((m) => m[1]));
const parse = (s: string) => s.split(', ').map((p) => p.split(' ') as [string, string]);

const icon = (name: string, id: string) => `// url=${URL_BASE}${id.replace(':', '-')}
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'
${kitIcons.has(name) ? '' : `// "${name}" is not in portal/src/kit/icons.ts yet: add it with portal/icons.ts.\n`}
export default {
  example: figma.tsx\`<Icon name="${name}" />\`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-${name}',
  metadata: { nestable: true, props: { name: '${name}' } },
}
`;
const app = (name: string, id: string) => `// url=${URL_BASE}${id.replace(':', '-')}
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'
${kitApps.has(name) ? '' : `// "${name}" has no glyph in the kit yet: AppIcon shows its first letter on a grey tile.\n`}
export default {
  example: figma.tsx\`<AppIcon id="${name}" size={52} />\`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-${name}',
  metadata: { nestable: true, props: { name: '${name}' } },
}
`;
const dir = new URL('./templates/', import.meta.url).pathname;
mkdirSync(dir + 'icons', { recursive: true });
mkdirSync(dir + 'apps', { recursive: true });
let missing = 0;
for (const [n, id] of parse(ICONS)) { writeFileSync(`${dir}icons/${n}.figma.ts`, icon(n, id)); if (!kitIcons.has(n)) missing++; }
for (const [n, id] of parse(APPS)) { writeFileSync(`${dir}apps/${n}.figma.ts`, app(n, id)); if (!kitApps.has(n)) missing++; }
console.log(`${parse(ICONS).length} icons, ${parse(APPS).length} app icons, ${missing} not in the kit yet`);
