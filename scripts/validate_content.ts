// Content gate: validates the merged registry; non-zero exit on any error.
// Runs in `npm run build` and `npm run gate` so bad content cannot ship.

import { CONTENT } from '../src/sim/content';
import { validateContent } from '../src/sim/content/schema';

const errors = validateContent(CONTENT);
if (errors.length > 0) {
  console.error(`content validation FAILED (${errors.length}):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
const counts = {
  items: Object.keys(CONTENT.items).length,
  effects: Object.keys(CONTENT.effects).length,
  spells: Object.keys(CONTENT.spells).length,
  perks: Object.keys(CONTENT.perks).length,
  actors: Object.keys(CONTENT.actors).length,
  spaces: Object.keys(CONTENT.spaces).length,
  props: CONTENT.props.length,
  doors: CONTENT.doors.length,
  spawners: CONTENT.spawners.length,
  containers: CONTENT.containers.length,
  quests: Object.keys(CONTENT.quests).length,
  dialogues: Object.keys(CONTENT.dialogues).length,
};
console.log('content OK:', JSON.stringify(counts));
