// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-175
// source=portal/src/kit/ui.tsx
// component=Progress
// example=<Progress value={40} label="Step 2 of 5" />
import figma from 'figma'
const instance = figma.selectedInstance

const value = instance.getEnum('Value', { '0': '0', '25': '25', '50': '50', '75': '75', '100': '100' })

// Leave value out when the box doesn't know how far along a task is: the bar moves instead.
export default {
  example: figma.tsx`<Progress value={${value}} label="..." />`,
  imports: ["import { Progress } from '../kit/ui.tsx'"],
  id: 'gurtos-progress',
  metadata: { nestable: true },
}
