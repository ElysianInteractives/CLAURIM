import type {
  EquipmentSlotView,
  EquippedConsumableView,
  EquippedSpellView,
  InventoryItemView,
  KnownSpellView,
  LootView,
} from '../world_api';

export const LOADOUT_CSS = `
  #hud .inventory-categories { display: grid; gap: 3px; margin-bottom: 20px; }
  #hud .category-button { width: 100%; padding: 7px 9px; color: #aaa493; background: transparent; border: 0;
    border-left: 2px solid transparent; font: 12px/1.25 Georgia, serif; text-align: left; cursor: pointer; }
  #hud .category-button:hover, #hud .category-button[aria-pressed="true"] { color: #f0e4c6; background: rgba(205,185,135,.08); border-color: #c9ad6c; }
  #hud .equipment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
  #hud .loadout-slot { min-height: 55px; padding: 7px 8px; color: inherit; background: rgba(255,255,255,.025);
    border: 1px solid rgba(194,177,132,.2); font: inherit; text-align: left; cursor: pointer; }
  #hud .loadout-slot:hover:not(:disabled) { border-color: rgba(230,210,150,.62); background: rgba(71,61,43,.42); }
  #hud .loadout-slot:disabled { cursor: default; opacity: .65; }
  #hud .slot-label { display: block; margin-bottom: 4px; color: #958b72; font: 9px/1.2 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
  #hud .slot-name { display: block; color: #e8dfc9; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #hud .inventory-list { display: grid; gap: 2px; }
  #hud .inventory-row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 12px;
    padding: 9px 10px; color: #d8d2c4; background: transparent; border: 0; border-left: 2px solid transparent; font: inherit; text-align: left; cursor: pointer; }
  #hud .inventory-row:hover, #hud .inventory-row.is-selected { color: #fff6de; background: linear-gradient(90deg, rgba(201,173,108,.16), transparent); border-color: #d2b774; }
  #hud .inventory-row .item-count, #hud .inventory-row .item-value { color: #918b7e; font: 11px/1 ui-monospace, monospace; }
  #hud .quick-assign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 8px; }
  #hud .quick-assign button { padding: 7px 4px; color: #d5cab0; background: rgba(45,52,59,.7); border: 1px solid rgba(137,164,183,.35); cursor: pointer; }
  #hud .quick-assign button[aria-pressed="true"] { color: #142029; background: #a9c0cc; }
  #hud .magic-layout { height: 100%; display: grid; grid-template-columns: minmax(220px,.8fr) minmax(300px,1.2fr); }
  #hud .spell-list { display: grid; gap: 4px; }
  #hud .spell-row { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 9px 10px; border-left: 2px solid transparent; }
  #hud .spell-row:nth-child(even) { background: rgba(255,255,255,.022); }
  #hud .spell-school { margin: 16px 0 6px; color: #8fa8c4; font-size: 10px; font-weight: normal; letter-spacing: .1em; text-transform: uppercase; }
  #hud .spell-actions { display: flex; gap: 5px; }
  #hud .loadout-action { padding: 5px 8px; color: #d8dfea; background: rgba(56,68,83,.46); border: 1px solid rgba(126,151,194,.4); cursor: pointer; }
  #hud .loadout-action[aria-pressed="true"] { color: #101822; background: #9eb5d3; }
  #hud .quickbar { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); display: flex; gap: 5px; }
  #hud .quickbar-slot { min-width: 105px; max-width: 150px; padding: 7px 8px; box-sizing: border-box; background: rgba(8,10,13,.84);
    border: 1px solid rgba(157,167,172,.42); box-shadow: 0 3px 15px rgba(0,0,0,.42); text-shadow: 0 1px 2px #000; }
  #hud .quickbar-slot--spell { border-color: rgba(126,151,194,.58); }
  #hud .quickbar-slot--item { border-color: rgba(173,151,105,.58); }
  #hud .quickbar-key { display: inline-block; margin-right: 6px; color: #f1e2b9; font: bold 11px/1 ui-monospace, monospace; }
  #hud .quickbar-name { color: #d9d7d0; font-size: 11px; }
  #hud .quickbar-count { margin-left: 5px; color: #a5a094; font: 10px/1 ui-monospace, monospace; }
  #hud .menu-frame.loot-frame { grid-template-rows: auto minmax(0, 1fr) auto; }
  #hud .loot-frame .menu-titlebar { border-bottom-color: rgba(194,177,132,.32); }
  #hud .loot-frame .menu-columns { grid-template-columns: minmax(320px,1.2fr) minmax(260px,.8fr); }
  #hud .loot-source-kind { color: #a99d80; text-transform: uppercase; letter-spacing: .12em; }
  @media (max-width: 820px) {
    #hud .equipment-grid { grid-template-columns: 1fr; }
    #hud .magic-layout { grid-template-columns: 1fr; }
    #hud .quickbar { bottom: 136px; }
    #hud .quickbar-slot { min-width: 58px; }
    #hud .quickbar-name { display: none; }
  }
`;

export type InventoryCategory = 'all' | 'weapon' | 'armor' | 'consumable' | 'ingredient' | 'tome' | 'misc' | 'quest';

const CATEGORIES: readonly { id: InventoryCategory; label: string }[] = [
  { id: 'all', label: 'All Items' }, { id: 'weapon', label: 'Weapons' }, { id: 'armor', label: 'Apparel' },
  { id: 'consumable', label: 'Consumables' }, { id: 'ingredient', label: 'Ingredients' }, { id: 'tome', label: 'Books' },
  { id: 'misc', label: 'Miscellaneous' }, { id: 'quest', label: 'Quest Items' },
];

export function renderLoadoutPanel(
  gold: number,
  equipment: readonly EquipmentSlotView[],
  _spellLoadout: readonly EquippedSpellView[],
  _knownSpells: readonly KnownSpellView[],
  inventory: readonly InventoryItemView[],
  consumables: readonly EquippedConsumableView[] = [],
  category: InventoryCategory = 'all',
  selectedItemId = '',
): string {
  const carried = inventory.filter((item) => !item.equipped && (category === 'all' || item.kind === category));
  const selected = carried.find((item) => item.itemId === selectedItemId) ?? carried[0] ?? null;
  const totalWeight = inventory.reduce((sum, item) => sum + item.weight * item.count, 0);
  const categories = CATEGORIES.map((entry) => `<button type="button" class="category-button" data-act="inventory-category" data-category="${entry.id}" aria-pressed="${entry.id === category}">${entry.label}</button>`).join('');
  const slots = equipment.map((slot) => `<button type="button" class="loadout-slot" data-act="unequip-item" data-slot="${escapeHtml(slot.slot)}"${slot.itemId ? '' : ' disabled'}>` +
    `<span class="slot-label">${escapeHtml(slot.label)}</span><span class="slot-name">${escapeHtml(slot.name ?? 'Empty')}</span></button>`).join('');
  const rows = carried.map((item) => `<button type="button" class="inventory-row${selected?.itemId === item.itemId ? ' is-selected' : ''}" data-act="select-item" data-id="${escapeHtml(item.itemId)}" aria-pressed="${selected?.itemId === item.itemId}">` +
    `<span>${escapeHtml(item.name)}</span><span class="item-count">×${item.count}</span><span class="item-value">${item.value}g</span></button>`).join('');
  return `<div class="menu-columns inventory-layout"><aside class="menu-column"><h2 class="menu-heading">Categories</h2><div class="inventory-categories">${categories}</div>` +
    `<h2 class="menu-heading">Equipped</h2><div class="equipment-grid">${slots}</div></aside>` +
    `<section class="menu-column" aria-label="Carried items"><h2 class="menu-heading">Carried Items · ${totalWeight.toFixed(1)} weight</h2>` +
    `<div class="inventory-list">${rows || '<div class="menu-empty">No items in this category.</div>'}</div></section>` +
    `<aside class="menu-column">${renderItemDetail(selected, consumables)}</aside></div>`;
}

function renderItemDetail(item: InventoryItemView | null, consumables: readonly EquippedConsumableView[]): string {
  if (!item) return '<div class="menu-empty">Select an item to inspect it.</div>';
  const action = item.kind === 'consumable' ? 'Use' : item.kind === 'tome' ? 'Study' : item.kind === 'weapon' || item.kind === 'armor' ? 'Equip' : '';
  let html = `<h2 class="detail-name">${escapeHtml(item.name)}</h2><div class="detail-kind">${escapeHtml(item.kind)}</div>` +
    `<div class="detail-stats"><div class="detail-stat"><strong>${item.count}</strong><span>Count</span></div>` +
    `<div class="detail-stat"><strong>${item.weight}</strong><span>Weight</span></div><div class="detail-stat"><strong>${item.value}</strong><span>Value</span></div></div>` +
    `<p class="detail-copy">${escapeHtml(item.detail)}</p>`;
  if (action) html += `<button type="button" class="primary-action" data-act="item" data-id="${escapeHtml(item.itemId)}">${action}</button>`;
  if (item.kind === 'consumable') {
    html += `<div class="quick-assign" aria-label="Assign consumable hotkey">${consumables.map((slot) =>
      `<button type="button" data-act="equip-consumable" data-id="${escapeHtml(item.itemId)}" data-slot="${slot.slot}" aria-pressed="${slot.itemId === item.itemId}">Assign ${slot.hotkey}</button>`
    ).join('')}</div>`;
  }
  return html;
}

export function renderMagicPanel(
  spellLoadout: readonly EquippedSpellView[],
  knownSpells: readonly KnownSpellView[],
): string {
  const slots = spellLoadout.map((spell) => `<button type="button" class="loadout-slot" data-act="unequip-spell" data-slot="${spell.slot}"${spell.spellId ? '' : ' disabled'}>` +
    `<span class="slot-label">Hotkey ${spell.hotkey}</span><span class="slot-name">${escapeHtml(spell.name ?? 'Empty')}</span></button>`).join('');
  let rows = '';
  let school = '';
  for (const spell of knownSpells) {
    if (spell.schoolName !== school) { school = spell.schoolName; rows += `<h3 class="spell-school">${escapeHtml(school)}</h3>`; }
    rows += `<div class="spell-row"><span><strong>${escapeHtml(spell.name)}</strong><br><span class="menu-meta">${spell.cost} magicka</span></span>` +
      `<span class="spell-actions">${spellLoadout.map((slot) => `<button type="button" class="loadout-action" data-act="equip-spell" data-id="${escapeHtml(spell.id)}" data-slot="${slot.slot}" aria-pressed="${slot.spellId === spell.id}">Equip ${slot.hotkey}</button>`).join('')}</span></div>`;
  }
  return `<div class="magic-layout"><aside class="menu-column"><h2 class="menu-heading">Equipped Spells</h2><div class="equipment-grid">${slots}</div></aside>` +
    `<section class="menu-column"><h2 class="menu-heading">Known Spells</h2><div class="spell-list">${rows || '<div class="menu-empty">Study a spell primer to begin.</div>'}</div></section></div>`;
}

export function renderLootPanel(loot: LootView, selectedItemId = ''): string {
  const selected = loot.items.find((item) => item.itemId === selectedItemId) ?? loot.items[0] ?? null;
  const rows = loot.items.map((item) => `<button type="button" class="inventory-row${selected?.itemId === item.itemId ? ' is-selected' : ''}" data-act="select-loot" data-id="${escapeHtml(item.itemId)}" aria-pressed="${selected?.itemId === item.itemId}">` +
    `<span>${escapeHtml(item.name)}</span><span class="item-count">×${item.count}</span><span class="item-value">${item.value}g</span></button>`).join('');
  const detail = selected ? `<h2 class="detail-name">${escapeHtml(selected.name)}</h2><div class="detail-kind">${escapeHtml(selected.kind)}</div>` +
    `<div class="detail-stats"><div class="detail-stat"><strong>${selected.count}</strong><span>Count</span></div><div class="detail-stat"><strong>${selected.weight}</strong><span>Weight</span></div><div class="detail-stat"><strong>${selected.value}</strong><span>Value</span></div></div>` +
    `<p class="detail-copy">${escapeHtml(selected.detail)}</p><button type="button" class="primary-action" data-act="loot-take" data-id="${escapeHtml(selected.itemId)}">Take</button>` :
    '<div class="menu-empty">Empty</div>';
  return `<div class="menu-overlay"><section class="menu-frame loot-frame" aria-label="Loot ${escapeHtml(loot.sourceName)}">` +
    `<header class="menu-titlebar"><div><span class="loot-source-kind">${loot.sourceKind}</span><h1>${escapeHtml(loot.sourceName)}</h1></div><span class="menu-meta">Choose what to take</span></header>` +
    `<div class="menu-content"><div class="menu-columns"><section class="menu-column"><h2 class="menu-heading">Contents</h2><div class="inventory-list">${rows || '<div class="menu-empty">Empty</div>'}</div></section><aside class="menu-column">${detail}</aside></div></div>` +
    `<footer class="menu-footer"><span><kbd>W/S</kbd> select · <kbd>Enter/E</kbd> take · <kbd>R</kbd> take all · <kbd>Esc</kbd> close</span><button type="button" data-act="loot-all"${loot.items.length ? '' : ' disabled'}>Take All</button></footer></section></div>`;
}

export function renderQuickbar(spells: readonly EquippedSpellView[], consumables: readonly EquippedConsumableView[] = []): string {
  const spellSlots = spells.map((spell) => `<div class="quickbar-slot quickbar-slot--spell"><span class="quickbar-key">${spell.hotkey}</span><span class="quickbar-name">${escapeHtml(spell.name ?? 'Empty')}</span></div>`);
  const itemSlots = consumables.map((item) => `<div class="quickbar-slot quickbar-slot--item"><span class="quickbar-key">${item.hotkey}</span><span class="quickbar-name">${escapeHtml(item.name ?? 'Empty')}</span>${item.itemId ? `<span class="quickbar-count">${item.count}</span>` : ''}</div>`);
  return `<div class="quickbar" aria-label="Quick access loadout">${[...spellSlots, ...itemSlots].join('')}</div>`;
}

/** Backward-compatible export used by presentation tests and older hosts. */
export const renderSpellQuickbar = renderQuickbar;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}
