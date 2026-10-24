// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-293
// source=portal/src/kit/ui.tsx
// component=Menu
// example=<Menu label="Task" items={[{ label: 'Undo task', run: undo, destructive: true }]} onClose={close} />
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const kind = instance.getEnum('Kind', { Default: 'default', Checked: 'checked', Destructive: 'destructive' })

// One entry of Menu's items. The kit shows a checked item with the object-select icon.
export default {
  example: figma.tsx`{ label: "${label}", run: () => ...${kind === 'destructive' ? ', destructive: true' : ''}${kind === 'checked' ? ", icon: 'object-select'" : ''} }`,
  imports: ["import { Menu, type MenuItem } from '../kit/ui.tsx'"],
  id: 'gurtos-menu-item',
  metadata: { nestable: true },
}
