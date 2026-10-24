// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3527
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="window-close" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-window-close',
  metadata: { nestable: true, props: { name: 'window-close' } },
}
