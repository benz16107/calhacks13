// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=78-226
// source=portal/src/kit/ui.tsx
// component=AppIcon
import figma from 'figma'
// "web" has no glyph in the kit yet: AppIcon shows its first letter on a grey tile.

export default {
  example: figma.tsx`<AppIcon id="web" size={52} />`,
  imports: ["import { AppIcon } from '../kit/ui.tsx'"],
  id: 'app-web',
  metadata: { nestable: true, props: { name: 'web' } },
}
