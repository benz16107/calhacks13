// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3506
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="user-home" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-user-home',
  metadata: { nestable: true, props: { name: 'user-home' } },
}
