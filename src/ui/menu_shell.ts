export type MenuDestination = 'inventory' | 'magic' | 'journal' | 'map' | 'perks' | 'social' | 'settings';

export const MENU_SHELL_CSS = `
  #hud .menu-overlay { position: absolute; inset: 0; padding: clamp(16px, 3vw, 44px); box-sizing: border-box;
    pointer-events: auto; background: radial-gradient(circle at 50% 10%, rgba(35,42,49,.76), rgba(5,7,9,.94) 68%);
    backdrop-filter: blur(7px); }
  #hud .menu-frame { width: min(1180px, 100%); height: min(780px, 100%); margin: auto; display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto; color: #e9e5d9; border: 1px solid rgba(194,177,132,.5);
    background: linear-gradient(150deg, rgba(18,22,25,.98), rgba(11,12,14,.97)); box-shadow: 0 22px 80px rgba(0,0,0,.76); }
  #hud .menu-titlebar { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 20px 26px 12px;
    border-bottom: 1px solid rgba(194,177,132,.22); }
  #hud .menu-titlebar h1 { margin: 0; color: #efe5c7; font: 30px/1.05 Georgia, serif; font-weight: normal; letter-spacing: .06em; }
  #hud .menu-meta { color: #b9ab88; font: 12px/1.4 ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  #hud .menu-nav { display: flex; gap: 2px; padding: 0 18px; overflow-x: auto; border-bottom: 1px solid rgba(194,177,132,.22); }
  #hud .menu-nav button { padding: 12px 13px 10px; color: #aaa28f; background: transparent; border: 0; border-bottom: 2px solid transparent;
    font: 11px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
  #hud .menu-nav button:hover, #hud .menu-nav button:focus-visible { color: #f5ebce; outline: none; }
  #hud .menu-nav button[aria-current="page"] { color: #f2dfac; border-color: #c9ad6c; }
  #hud .menu-content { min-height: 0; overflow: hidden; }
  #hud .menu-content .panel { position: static; transform: none; width: auto; min-width: 0; max-width: none; max-height: none;
    height: 100%; box-sizing: border-box; margin: 0; padding: 22px 26px; overflow-y: auto; color: inherit; background: transparent;
    border: 0; border-radius: 0; box-shadow: none; }
  #hud .menu-content .row { width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; gap: 12px;
    margin: 2px 0; padding: 8px 10px; color: inherit; background: transparent; border: 0; font: inherit; text-align: left; }
  #hud .menu-content button.row, #hud .menu-content .row[data-act] { cursor: pointer; }
  #hud .menu-content button.row:hover, #hud .menu-content .row[data-act]:hover { background: rgba(200,180,120,.11); }
  #hud .menu-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 9px 18px; color: #9e9788;
    border-top: 1px solid rgba(194,177,132,.2); font: 11px/1.4 ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  #hud .menu-footer kbd { margin-right: 4px; }
  #hud .menu-footer button { padding: 5px 12px; color: #e3d8bc; background: rgba(74,66,50,.48); border: 1px solid rgba(194,177,132,.32); cursor: pointer; }
  #hud .menu-footer button:disabled { opacity: .35; cursor: default; }
  #hud .menu-columns { height: 100%; display: grid; grid-template-columns: minmax(190px, .75fr) minmax(300px, 1.35fr) minmax(250px, 1fr); }
  #hud .menu-column { min-width: 0; min-height: 0; padding: 18px; overflow-y: auto; box-sizing: border-box; }
  #hud .menu-column + .menu-column { border-left: 1px solid rgba(194,177,132,.18); }
  #hud .menu-heading { margin: 0 0 10px; color: #cbb989; font-size: 11px; font-weight: normal; letter-spacing: .12em; text-transform: uppercase; }
  #hud .menu-empty { padding: 24px 10px; color: #999384; text-align: center; font-style: italic; }
  #hud .detail-name { margin: 0 0 5px; color: #f1e7cd; font-size: 24px; font-weight: normal; }
  #hud .detail-kind { color: #b5a476; font: 11px/1.3 ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; }
  #hud .detail-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 18px 0; }
  #hud .detail-stat { padding: 9px 6px; text-align: center; background: rgba(255,255,255,.025); border: 1px solid rgba(194,177,132,.16); }
  #hud .detail-stat strong { display: block; color: #e9dcba; font: 15px/1.2 ui-monospace, monospace; }
  #hud .detail-stat span { color: #918a7b; font-size: 10px; text-transform: uppercase; }
  #hud .detail-copy { color: #beb7a7; line-height: 1.5; }
  #hud .primary-action { width: 100%; margin-top: 16px; padding: 10px 12px; color: #17140e; background: #c9b171;
    border: 1px solid #eadba8; font: 12px/1.2 ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; }
  #hud .primary-action:hover { background: #e0c984; }
  #hud .primary-action:disabled { opacity: .4; cursor: default; }
  #hud .secondary-actions { display: flex; gap: 6px; margin-top: 8px; }
  #hud .secondary-actions button { flex: 1; padding: 7px; color: #d9d0ba; background: rgba(74,66,50,.5); border: 1px solid rgba(194,177,132,.3); cursor: pointer; }
  #hud .section-panel { height: 100%; overflow-y: auto; padding: 22px 26px; box-sizing: border-box; }
  #hud .section-panel h2 { margin: 0 0 16px; color: #e8dcbd; font-weight: normal; }
  @media (max-width: 820px) {
    #hud .menu-overlay { padding: 8px; }
    #hud .menu-frame { height: 100%; }
    #hud .menu-titlebar { padding: 14px 15px 9px; }
    #hud .menu-titlebar h1 { font-size: 23px; }
    #hud .menu-columns { grid-template-columns: 150px minmax(220px, 1fr); }
    #hud .menu-columns > .menu-column:last-child { display: none; }
    #hud .menu-footer span:last-child { display: none; }
  }
`;

const DESTINATIONS: readonly { id: MenuDestination; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'magic', label: 'Magic' },
  { id: 'journal', label: 'Journal' },
  { id: 'map', label: 'Map' },
  { id: 'perks', label: 'Character' },
  { id: 'social', label: 'Social' },
  { id: 'settings', label: 'System' },
];

export function renderMenuShell(
  active: MenuDestination,
  title: string,
  content: string,
  meta = '',
  footer = '<kbd>W/S</kbd> select · <kbd>Enter</kbd> accept · <kbd>Esc</kbd> close',
): string {
  return `<div class="menu-overlay"><section class="menu-frame" aria-label="${escapeHtml(title)} menu">` +
    `<header class="menu-titlebar"><h1>${escapeHtml(title)}</h1><span class="menu-meta">${escapeHtml(meta)}</span></header>` +
    `<nav class="menu-nav" aria-label="Main menu">${DESTINATIONS.map((destination) =>
      `<button type="button" data-act="menu-nav" data-panel="${destination.id}"${destination.id === active ? ' aria-current="page"' : ''}>${destination.label}</button>`
    ).join('')}</nav>` +
    `<div class="menu-content">${content}</div>` +
    `<footer class="menu-footer"><span>${footer}</span><span>The world remains active while menus are open</span></footer>` +
    `</section></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}
