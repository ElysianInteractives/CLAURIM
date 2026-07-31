// IP-boundary gate: scans content prose (names, dialogue, journals) for
// protected proper nouns and famous-phrase fragments. Maintained list, not
// exhaustive: the human checklist in IP_STYLE_GUIDE.md still applies.
// Runs in `npm run validate` (build + gate).

import { CONTENT } from '../src/sim/content';

// Lower-cased protected fragments. Word-ish matching (substring on prose is
// deliberate: catches compounds). Extend as content grows.
const PROTECTED: string[] = [
  // Inspiration-franchise place/person/faction names (representative set).
  'skyrim', 'tamriel', 'whiterun', 'riverwood', 'solitude ', 'windhelm', 'riften',
  'markarth', 'dawnstar', 'winterhold', 'morthal', 'falkreath', 'ivarstead',
  'dragonsreach', 'jorrvaskr', 'sovngarde', 'dovahkiin', 'dragonborn',
  'greybeard', 'ulfric', 'stormcloak', 'thalmor', 'aldmeri', 'ysolda',
  'lucan valerius', 'belethor', 'nazeem', 'lydia ', 'aela ', 'delphine',
  'alduin', 'paarthurnax', 'fus ro dah', 'daedra', 'dwemer', 'draugr',
  'nirnroot', 'septim', 'akatosh', 'talos', 'azura', 'molag', 'mehrunes',
  'hircine', 'nocturnal ', 'blackreach', 'high hrothgar',
  // Famous-catchphrase fragments.
  'arrow in the knee', 'sweet roll', 'cloud district',
];

const findings: string[] = [];

function scan(where: string, text: string): void {
  const lower = ' ' + text.toLowerCase() + ' ';
  for (const term of PROTECTED) {
    if (lower.includes(term)) findings.push(`${where}: contains protected fragment "${term.trim()}"`);
  }
}

for (const [id, a] of Object.entries(CONTENT.actors)) scan(`actor ${id}`, a.name);
for (const [id, item] of Object.entries(CONTENT.items)) scan(`item ${id}`, item.name);
for (const [id, s] of Object.entries(CONTENT.spaces)) scan(`space ${id}`, s.name);
for (const [id, q] of Object.entries(CONTENT.quests)) {
  scan(`quest ${id}`, q.name);
  for (const st of q.stages) scan(`quest ${id}/${st.id}`, st.journal + ' ' + st.objectives.map((o) => o.text).join(' '));
}
for (const [id, d] of Object.entries(CONTENT.dialogues)) {
  for (const n of d.nodes) scan(`dialogue ${id}/${n.id}`, n.text + ' ' + n.choices.map((c) => c.text).join(' '));
}

if (findings.length > 0) {
  console.error(`IP check FAILED (${findings.length}):`);
  for (const f of findings) console.error('  - ' + f);
  process.exit(1);
}
console.log('IP check OK: no protected fragments in content prose');
