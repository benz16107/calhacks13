// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3398
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="dialog-warning" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-dialog-warning',
  metadata: { nestable: true, props: { name: 'dialog-warning' } },
}
