// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-280
// source=portal/src/kit/ui.tsx
// component=Alert
// example=<Alert title="Undo this task?" body="Its changes go back." action="Undo task" destructive onConfirm={undo} onCancel={close} />
import figma from 'figma'
const instance = figma.selectedInstance

const title = instance.getString('Title')
const body = instance.getString('Body')
const action = instance.getString('Action')
const destructive = instance.getEnum('Kind', { Destructive: true, Suggested: false })

export default {
  example: figma.tsx`<Alert title="${title}" body="${body}" action="${action}"${destructive ? ' destructive' : ''} onConfirm={...} onCancel={...} />`,
  imports: ["import { Alert } from '../kit/ui.tsx'"],
  id: 'gurtos-alert',
  metadata: { nestable: false },
}
