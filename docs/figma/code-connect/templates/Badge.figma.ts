// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-147
// source=portal/src/kit/ui.tsx
// component=Badge
// example=<Badge kind="accent">Running</Badge>
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const kind = instance.getEnum('Kind', { Attention: 'attention', Accent: 'accent', Neutral: 'neutral', Success: 'success', Destructive: 'destructive' })

export default {
  example: figma.tsx`<Badge${kind !== 'attention' ? figma.tsx` kind="${kind}"` : ''}>${label}</Badge>`,
  imports: ["import { Badge } from '../kit/ui.tsx'"],
  id: 'gurtos-badge',
  metadata: { nestable: true },
}
