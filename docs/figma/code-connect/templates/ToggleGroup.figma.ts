// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=50-182
// source=portal/src/kit/ui.tsx
// component=ToggleGroup
// example=<ToggleGroup label="View" value={view} options={[['all', 'All'], ['running', 'Running', 2]]} onChange={setView} />
import figma from 'figma'

// Each ToggleItem in Figma is one option: [value, label, count?].
export default {
  example: figma.tsx`<ToggleGroup label="..." value={view} options={[['all', 'All'], ['running', 'Running', 2], ['done', 'Done']]} onChange={setView} />`,
  imports: ["import { ToggleGroup } from '../kit/ui.tsx'"],
  id: 'gurtos-toggle-group',
  metadata: { nestable: false },
}
