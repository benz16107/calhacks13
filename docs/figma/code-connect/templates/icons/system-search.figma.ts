// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3500
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="system-search" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-system-search',
  metadata: { nestable: true, props: { name: 'system-search' } },
}
