import type {
  EquipmentSlotView,
  EquippedSpellView,
  InventoryItemView,
  KnownSpellView,
} from '../world_api';

export const LOADOUT_CSS = `
  #hud .loadout-panel { width: min(780px, calc(100vw - 48px)); max-width: 780px; min-width: 0; box-sizing: border-box; }
  #hud .loadout-section + .loadout-section { margin-top: 17px; }
  #hud .loadout-section h3 { margin: 0 0 8px; color: #cdbd8d; font-size: 12px; font-weight: normal;
    letter-spacing: .11em; text-transform: uppercase; }
  #hud .equipment-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
  #hud .spell-slot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  #hud .loadout-slot { min-height: 62px; padding: 8px 10px; color: inherit; background: rgba(40,35,27,.7);
    border: 1px solid rgba(205,189,141,.32); border-radius: 4px; font: inherit; text-align: left; cursor: pointer; }
  #hud .loadout-slot:hover:not(:disabled) { border-color: rgba(230,210,150,.72); background: rgba(71,61,43,.72); }
  #hud .loadout-slot:disabled { color: inherit; cursor: default; opacity: .65; }
  #hud .slot-label { display: block; margin-bottom: 5px; color: #a99b79; font: 10px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace;
    letter-spacing: .08em; text-transform: uppercase; }
  #hud .slot-name { display: block; color: #f0e6cc; font-size: 14px; }
  #hud .slot-detail { display: block; margin-top: 3px; color: #ad9f7d; font-size: 11px; }
  #hud .known-spell { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px;
    padding: 7px 8px; margin: 2px 0; border-radius: 3px; }
  #hud .known-spell:nth-child(even) { background: rgba(255,255,255,.025); }
  #hud .spell-school { margin-top: 10px; color: #9fb4d7; font-size: 11px; font-weight: normal;
    letter-spacing: .09em; text-transform: uppercase; }
  #hud .spell-actions { display: flex; gap: 5px; }
  #hud .loadout-action { min-width: 58px; padding: 5px 8px; color: #eee4c9; background: rgba(90,76,50,.45);
    border: 1px solid rgba(205,189,141,.38); border-radius: 3px; font: 11px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace; cursor: pointer; }
  #hud .loadout-action[aria-pressed="true"] { color: #17130d; background: #cdbd8d; border-color: #e9dcae; }
  #hud .loadout-action:hover { border-color: #e3d29c; }
  #hud .carried-list .row { border: 1px solid transparent; }
  #hud .spellbar { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; gap: 8px; }
  #hud .spellbar-slot { min-width: 126px; padding: 7px 9px; box-sizing: border-box; background: rgba(9,10,14,.82);
    border: 1px solid rgba(126,151,194,.58); border-radius: 4px; box-shadow: 0 3px 15px rgba(0,0,0,.42); text-shadow: 0 1px 2px #000; }
  #hud .spellbar-key { display: inline-block; margin-right: 7px; color: #dbe7ff; font: bold 11px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  #hud .spellbar-name { color: #d7e1f5; font-size: 12px; }
  @media (max-width: 680px) {
    #hud .equipment-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #hud .known-spell { grid-template-columns: 1fr; }
    #hud .spellbar { bottom: 142px; }
    #hud .spellbar-slot { min-width: 104px; }
  }
`;

export function renderLoadoutPanel(
  gold: number,
  equipment: readonly EquipmentSlotView[],
  spellLoadout: readonly EquippedSpellView[],
  knownSpells: readonly KnownSpellView[],
  inventory: readonly InventoryItemView[],
): string {
  const carried = inventory.filter((item) => !item.equipped);
  let html = `<section class="panel loadout-panel" aria-label="Inventory and loadout"><h2>Inventory &amp; Loadout (${gold} gold)</h2>`;

  html += `<section class="loadout-section" aria-labelledby="equipment-heading"><h3 id="equipment-heading">Equipped items</h3><div class="equipment-grid">`;
  for (const slot of equipment) {
    const detail = slot.itemId ? `${slot.kind ?? 'item'} · click to unequip` : 'Empty slot';
    html += `<button type="button" class="loadout-slot" data-act="unequip-item" data-slot="${escapeHtml(slot.slot)}"${slot.itemId ? '' : ' disabled'}>` +
      `<span class="slot-label">${escapeHtml(slot.label)}</span><span class="slot-name">${escapeHtml(slot.name ?? 'Empty')}</span>` +
      `<span class="slot-detail">${escapeHtml(detail)}</span></button>`;
  }
  html += `</div></section>`;

  html += `<section class="loadout-section" aria-labelledby="spell-loadout-heading"><h3 id="spell-loadout-heading">Spell loadout</h3><div class="spell-slot-grid">`;
  for (const spell of spellLoadout) {
    html += `<button type="button" class="loadout-slot" data-act="unequip-spell" data-slot="${spell.slot}"${spell.spellId ? '' : ' disabled'}>` +
      `<span class="slot-label">Hotkey ${spell.hotkey}</span><span class="slot-name">${escapeHtml(spell.name ?? 'Empty')}</span>` +
      `<span class="slot-detail">${spell.cost === null ? 'Choose a known spell below' : `${spell.cost} magicka · click to clear`}</span></button>`;
  }
  html += `</div></section>`;

  html += `<section class="loadout-section" aria-labelledby="known-spells-heading"><h3 id="known-spells-heading">Known spells</h3>`;
  if (knownSpells.length === 0) html += `<div class="row static dim">No spells known. Study a spell primer to begin.</div>`;
  let activeSchool = '';
  for (const spell of knownSpells) {
    if (spell.school !== activeSchool) {
      activeSchool = spell.school;
      html += `<h4 class="spell-school">${escapeHtml(spell.schoolName)}</h4>`;
    }
    const slot1 = spellLoadout.some((entry) => entry.slot === 'spell1' && entry.spellId === spell.id);
    const slot2 = spellLoadout.some((entry) => entry.slot === 'spell2' && entry.spellId === spell.id);
    html += `<div class="known-spell"><span><strong>${escapeHtml(spell.name)}</strong> <span class="dim">${spell.cost} magicka</span></span>` +
      `<span class="spell-actions"><button type="button" class="loadout-action" data-act="equip-spell" data-slot="spell1" data-id="${escapeHtml(spell.id)}" aria-pressed="${slot1}">Equip 1</button>` +
      `<button type="button" class="loadout-action" data-act="equip-spell" data-slot="spell2" data-id="${escapeHtml(spell.id)}" aria-pressed="${slot2}">Equip 2</button></span></div>`;
  }
  html += `</section>`;

  html += `<section class="loadout-section carried-list" aria-labelledby="carried-heading"><h3 id="carried-heading">Carried items</h3>`;
  if (carried.length === 0) html += `<div class="row static dim">No unequipped items carried.</div>`;
  for (const item of carried) {
    const action = item.kind === 'consumable' ? 'Use' : item.kind === 'tome' ? 'Study' : item.kind === 'weapon' || item.kind === 'armor' ? 'Equip' : item.kind;
    html += `<button type="button" class="row" data-act="item" data-id="${escapeHtml(item.itemId)}"><span>${escapeHtml(item.name)} ×${item.count}</span><span class="dim">${escapeHtml(action)}</span></button>`;
  }
  html += `<div class="hint"><kbd>Tab</kbd> close · equip gear or spells from their lists</div></section></section>`;
  return html;
}

export function renderSpellQuickbar(spells: readonly EquippedSpellView[]): string {
  return `<div class="spellbar" aria-label="Equipped spells">${spells.map((spell) =>
    `<div class="spellbar-slot"><span class="spellbar-key">${spell.hotkey}</span><span class="spellbar-name">${escapeHtml(spell.name ?? 'Empty')}</span></div>`
  ).join('')}</div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]!);
}
