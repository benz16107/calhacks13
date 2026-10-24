// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=50-174
// source=portal/src/setup.tsx
// component=g-step
// example=<button class="g-step" data-state="current" aria-current="step">AI models</button>
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const state = instance.getEnum('State', { Done: 'done', Current: 'current', Upcoming: 'upcoming' })

export default {
  example: figma.tsx`<button type="button" class="g-step" data-state="${state}"${state === 'current' ? ' aria-current="step"' : ''}>${label}</button>`,
  imports: [],
  id: 'gurtos-step-item',
  metadata: { nestable: true },
}
