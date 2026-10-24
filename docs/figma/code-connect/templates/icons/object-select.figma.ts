// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3440
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="object-select" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-object-select',
  metadata: { nestable: true, props: { name: 'object-select' } },
}
