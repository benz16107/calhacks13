// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3419
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="list-add" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-list-add',
  metadata: { nestable: true, props: { name: 'list-add' } },
}
