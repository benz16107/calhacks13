// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=48-163
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'

export default {
  example: figma.tsx`<AppIcon id="find" size={52} />`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-find',
  metadata: { nestable: true, props: { name: 'find' } },
}
