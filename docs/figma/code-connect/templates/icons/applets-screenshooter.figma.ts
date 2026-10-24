// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=99-11386
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'
// "applets-screenshooter" is not in portal/src/kit/icons.ts yet: add it with portal/icons.ts.

export default {
  example: figma.tsx`<Icon name="applets-screenshooter" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-applets-screenshooter',
  metadata: { nestable: true, props: { name: 'applets-screenshooter' } },
}
