// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-205
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'
// "mana" has no glyph in the kit yet: AppIcon shows its first letter on a grey tile.

export default {
  example: figma.tsx`<AppIcon id="mana" size={52} />`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-mana',
  metadata: { nestable: true, props: { name: 'mana' } },
}
