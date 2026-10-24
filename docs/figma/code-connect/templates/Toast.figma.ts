// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-208
// source=portal/src/kit/gurtos.ts
// component=gurtos.toast
// example=gurtos.toast('Task undone', { label: 'Redo', run: redo })
import figma from 'figma'
const instance = figma.selectedInstance

const message = instance.getString('Message')
const action = instance.getBoolean('Show action') ? instance.getString('Action') : ''

export default {
  example: action
    ? figma.tsx`gurtos.toast("${message}", { label: "${action}", run: () => ... })`
    : figma.tsx`gurtos.toast("${message}")`,
  imports: [],
  id: 'gurtos-toast',
  metadata: { nestable: false },
}
