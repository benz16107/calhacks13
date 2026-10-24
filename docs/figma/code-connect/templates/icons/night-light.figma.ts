// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=99-11398
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'
// "night-light" is not in portal/src/kit/icons.ts yet: add it with portal/icons.ts.

export default {
  example: figma.tsx`<Icon name="night-light" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-night-light',
  metadata: { nestable: true, props: { name: 'night-light' } },
}
