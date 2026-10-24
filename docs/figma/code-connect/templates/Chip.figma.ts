// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-148
// source=portal/src/kit/ui.tsx
// component=Chip
// example=<Chip icon="web-browser">example.com</Chip>
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const icon = instance.getInstanceSwap('Icon')
let iconName
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name

export default {
  example: figma.tsx`<Chip${iconName ? figma.tsx` icon="${iconName}"` : ''}>${label}</Chip>`,
  imports: ["import { Chip } from '../kit/ui.tsx'"],
  id: 'gurtos-chip',
  metadata: { nestable: true },
}
