// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3431
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="network-server" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-network-server',
  metadata: { nestable: true, props: { name: 'network-server' } },
}
