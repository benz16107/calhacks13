// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3518
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="view-more" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-view-more',
  metadata: { nestable: true, props: { name: 'view-more' } },
}
