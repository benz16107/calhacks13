// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=99-11389
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'
// "audio-volume-high" is not in portal/src/kit/icons.ts yet: add it with portal/icons.ts.

export default {
  example: figma.tsx`<Icon name="audio-volume-high" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-audio-volume-high',
  metadata: { nestable: true, props: { name: 'audio-volume-high' } },
}
