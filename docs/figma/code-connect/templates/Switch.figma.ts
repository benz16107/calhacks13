// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-136
// source=portal/src/kit/ui.tsx
// component=Switch
// example=<Switch checked={on} onChange={setOn} label="Quiet hours" />
import figma from 'figma'
const instance = figma.selectedInstance

const checked = instance.getEnum('State', { On: 'true', Off: 'false' })

export default {
  example: figma.tsx`<Switch checked={${checked}} onChange={(on) => ...} label="..." />`,
  imports: ["import { Switch } from '../kit/ui.tsx'"],
  id: 'gurtos-switch',
  metadata: { nestable: true },
}
