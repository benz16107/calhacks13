// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=48-119
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'

export default {
  example: figma.tsx`<AppIcon id="settings" size={52} />`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-settings',
  metadata: { nestable: true, props: { name: 'settings' } },
}
