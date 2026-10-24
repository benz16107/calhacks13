// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=99-11401
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'
// "power-profile-balanced" is not in portal/src/kit/icons.ts yet: add it with portal/icons.ts.

export default {
  example: figma.tsx`<Icon name="power-profile-balanced" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-power-profile-balanced',
  metadata: { nestable: true, props: { name: 'power-profile-balanced' } },
}
