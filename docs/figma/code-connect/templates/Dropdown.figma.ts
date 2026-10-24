// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-162
// source=portal/src/kit/ui.tsx
// component=ComboRow
// example=<ComboRow title="Worker" value={worker} options={[['droid', 'Droid']]} onChange={setWorker} />
import figma from 'figma'
const instance = figma.selectedInstance

const value = instance.getString('Value')

// In a row, use ComboRow. On its own, a native select with the g-combo class, so keyboards and phones work.
export default {
  example: figma.tsx`<span class="g-combo-wrap"><select class="g-combo" aria-label="..."><option>${value}</option></select><Icon name="pan-down" /></span>`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'gurtos-dropdown',
  metadata: { nestable: true },
}
