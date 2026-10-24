// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3503
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="system-shutdown" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-system-shutdown',
  metadata: { nestable: true, props: { name: 'system-shutdown' } },
}
