// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3497
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="system-lock-screen" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-system-lock-screen',
  metadata: { nestable: true, props: { name: 'system-lock-screen' } },
}
