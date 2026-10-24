// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=48-109
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'

export default {
  example: figma.tsx`<AppIcon id="time-machine" size={52} />`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-time-machine',
  metadata: { nestable: true, props: { name: 'time-machine' } },
}
