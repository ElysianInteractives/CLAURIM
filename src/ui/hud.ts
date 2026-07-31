// The HUD + menus: resource bars, crosshair, interaction prompt, notification
// feed, dialogue panel, shop, inventory, journal, perks, and the death screen.
// Observes IWorld and submits intent through it; never resolves outcomes.

import type { IWorld } from '../world_api';

const CSS = `
  #hud { position: fixed; inset: 0; pointer-events: none; font-family: Georgia, 'Times New Roman', serif; color: #e8e0cc; user-select: none; }
  #hud .bars { position: absolute; left: 24px; bottom: 24px; width: 260px; }
  #hud .bar { height: 14px; margin-top: 6px; background: rgba(10,10,14,.65); border: 1px solid rgba(230,220,190,.35); border-radius: 3px; overflow: hidden; }
  #hud .bar > div { height: 100%; transition: width .12s; }
  #hud .hp > div { background: #a03327; } #hud .st > div { background: #3f7a37; } #hud .mg > div { background: #35558a; }
  #hud .crosshair { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); font-size: 18px; opacity: .8; }
  #hud .prompt { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); font-size: 18px; text-shadow: 0 1px 3px #000; }
  #hud .feed { position: absolute; right: 24px; top: 24px; width: 320px; text-align: right; font-size: 14px; text-shadow: 0 1px 2px #000; }
  #hud .feed div { margin-bottom: 3px; opacity: .95; }
  #hud .clockrow { position: absolute; left: 24px; top: 18px; font-size: 14px; opacity: .85; text-shadow: 0 1px 2px #000; }
  #hud .panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); min-width: 420px; max-width: 620px; max-height: 70vh; overflow-y: auto;
    background: rgba(14,12,10,.93); border: 1px solid #8a7a55; border-radius: 6px; padding: 18px 22px; pointer-events: auto; box-shadow: 0 8px 40px #000; }
  #hud .panel h2 { margin: 0 0 10px; font-size: 20px; color: #d8c890; border-bottom: 1px solid #665533; padding-bottom: 6px; }
  #hud .panel .row { padding: 5px 8px; margin: 2px 0; border-radius: 3px; cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
  #hud .panel .row:hover { background: rgba(200,180,120,.15); }
  #hud .panel .row.static { cursor: default; }
  #hud .panel .dim { opacity: .55; }
  #hud .panel .speaker { font-style: italic; color: #c9b880; margin-bottom: 8px; }
  #hud .panel .text { line-height: 1.5; margin-bottom: 14px; }
  #hud .hint { font-size: 12px; opacity: .6; margin-top: 10px; }
  #hud .death { position: absolute; inset: 0; background: rgba(20,0,0,.72); display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; }
  #hud .death h1 { font-size: 44px; color: #c9b880; }
  #hud .done { color: #7a9a5f; }
  #hud .partyframes { position: absolute; left: 24px; top: 52px; width: 180px; }
  #hud .pmember { margin-bottom: 8px; font-size: 13px; text-shadow: 0 1px 2px #000; }
  #hud .pmember .bar { height: 8px; margin-top: 2px; }
  #hud .pdowntag { color: #d05040; font-weight: bold; }
  #hud .pdown span { opacity: .7; }
`;

type Panel = 'none' | 'dialogue' | 'shop' | 'inventory' | 'journal' | 'perks';

export class Hud {
  private root: HTMLDivElement;
  private feedLines: { text: string; until: number }[] = [];
  panel: Panel = 'none';
  private time = 0;

  constructor(private world: IWorld) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    document.body.appendChild(this.root);
  }

  notify(text: string): void {
    this.feedLines.push({ text, until: this.time + 5 });
    if (this.feedLines.length > 8) this.feedLines.shift();
  }

  togglePanel(p: Panel): void {
    this.panel = this.panel === p ? 'none' : p;
  }

  isMenuOpen(): boolean {
    return this.panel !== 'none';
  }

  update(dtSec: number): void {
    this.time += dtSec;
    // Sim events -> notifications.
    for (const e of this.world.drainEvents()) {
      switch (e.type) {
        case 'questStarted':
          this.notify('Quest started: ' + this.questName(e.questId));
          break;
        case 'questAdvanced':
          this.notify('Journal updated');
          break;
        case 'questCompleted':
          this.notify('Quest completed: ' + this.questName(e.questId));
          break;
        case 'objectiveProgress':
          this.notify(`Objective: ${e.progress}/${e.required}`);
          break;
        case 'skillUp':
          this.notify(`${e.skill} increased to ${e.level}`);
          break;
        case 'levelUp':
          this.notify(`Level up! You are now level ${e.level}`);
          break;
        case 'itemAdded':
          this.notify(`+ ${e.count} ${e.itemId}`);
          break;
        case 'death':
          this.notify('Slain: ' + e.templateId);
          break;
        case 'telegraph':
          this.notify(e.interruptible ? '! Interruptible cast incoming !' : '! Dangerous attack incoming !');
          break;
        case 'interrupted':
          this.notify('Cast interrupted!');
          break;
        case 'bossPhase':
          this.notify(`The enemy grows more dangerous (phase ${e.phase + 1})`);
          break;
        case 'encounterWipe':
          this.notify('Your party has fallen. The encounter resets.');
          break;
        case 'playerDowned':
          this.notify('A companion is down!');
          break;
        case 'playerRevived':
          this.notify('Companion revived');
          break;
        case 'chat': {
          const speaker = this.world.actorsInSpace().find((a) => a.id === e.playerId);
          this.notify(`${speaker?.name ?? '???'}: ${e.text}`);
          break;
        }
        default:
          break;
      }
    }
    this.feedLines = this.feedLines.filter((l) => l.until > this.time);

    // Dialogue/shop panels follow authoritative state, not local history:
    // an open shop view forces the shop panel even if the dialogue frame was
    // never rendered (frame skips, online snapshot gaps).
    if (this.world.dialogueView()) this.panel = 'dialogue';
    else if (this.world.shopView()) this.panel = 'shop';
    else if (this.panel === 'dialogue' || this.panel === 'shop') this.panel = 'none';

    this.root.innerHTML = this.renderHtml();
    this.bindPanelClicks();
  }

  private questName(id: string): string {
    return this.world.journal().find((j) => j.questId === id)?.name ?? id;
  }

  private renderHtml(): string {
    const r = this.world.playerResources();
    const hour = this.world.gameHours() % 24;
    const hh = String(Math.floor(hour)).padStart(2, '0');
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
    const prompt = this.world.nearestInteractablePrompt();
    let html = `
      <div class="clockrow">Kaldwyn Reach - ${hh}:${mm} - Level ${r.level} - ${r.gold} gold</div>
      <div class="bars">
        <div class="bar hp"><div style="width:${(100 * r.health) / r.maxHealth}%"></div></div>
        <div class="bar st"><div style="width:${(100 * r.stamina) / r.maxStamina}%"></div></div>
        <div class="bar mg"><div style="width:${(100 * r.magicka) / r.maxMagicka}%"></div></div>
      </div>
      <div class="crosshair">·</div>
      <div class="feed">${this.feedLines.map((l) => `<div>${esc(l.text)}</div>`).join('')}</div>
    `;
    if (prompt && this.panel === 'none') html += `<div class="prompt">[E] ${esc(prompt)}</div>`;
    // Party frames (multiplayer presence).
    const party = this.world.party();
    if (party.length > 1) {
      html += `<div class="partyframes">`;
      for (const m of party) {
        if (m.isSelf) continue;
        html += `<div class="pmember${m.downed ? ' pdown' : ''}"><span>${esc(m.name)}</span><div class="bar hp"><div style="width:${(100 * m.health) / m.maxHealth}%"></div></div>${m.downed ? '<span class="pdowntag">DOWN</span>' : ''}</div>`;
      }
      html += `</div>`;
    }
    if (this.world.playerDowned()) {
      const secs = Math.ceil(this.world.downedTicksLeft() / 30);
      html += `<div class="death"><h1>You are down.</h1><div class="row static">A party member can revive you. Auto-release in ${secs}s.</div><div class="row" data-act="respawn">Release now</div></div>`;
      return html;
    }
    switch (this.panel) {
      case 'dialogue': {
        const d = this.world.dialogueView();
        if (d) {
          html += `<div class="panel"><div class="speaker">${esc(d.speakerName)}</div><div class="text">${esc(d.text)}</div>` +
            d.choices.map((c, i) => `<div class="row" data-act="dlg" data-i="${i}">${esc(c)}</div>`).join('') +
            `</div>`;
        }
        break;
      }
      case 'shop': {
        const s = this.world.shopView();
        if (s) {
          html += `<div class="panel"><h2>${esc(s.merchantName)} - Trade</h2>`;
          html += `<div class="row static dim">Buy:</div>`;
          html += s.stock
            .map((it) => `<div class="row" data-act="buy" data-id="${it.itemId}"><span>${esc(it.name)} x${it.count}</span><span>${it.price}g</span></div>`)
            .join('');
          html += `<div class="row static dim">Sell:</div>`;
          html += s.sellable
            .map((it) => `<div class="row" data-act="sell" data-id="${it.itemId}"><span>${esc(it.name)} x${it.count}</span><span>${it.price}g</span></div>`)
            .join('');
          html += `<div class="hint">Click to trade - [Esc] close</div></div>`;
        }
        break;
      }
      case 'inventory': {
        const inv = this.world.playerInventory();
        html += `<div class="panel"><h2>Inventory (${this.world.playerResources().gold} gold)</h2>`;
        html += inv
          .map(
            (it) =>
              `<div class="row" data-act="item" data-id="${it.itemId}"><span>${it.equipped ? '* ' : ''}${esc(it.name)} x${it.count}</span><span class="dim">${it.kind}</span></div>`,
          )
          .join('');
        html += `<div class="hint">Click: equip weapon/armor, drink consumable - [Tab] close</div></div>`;
        break;
      }
      case 'journal': {
        const quests = this.world.journal();
        html += `<div class="panel"><h2>Journal</h2>`;
        if (quests.length === 0) html += `<div class="row static dim">No quests yet. Someone in Fenharrow may need help.</div>`;
        for (const q of quests) {
          html += `<div class="row static"><b>${esc(q.name)}${q.completed ? ' (done)' : ''}</b></div>`;
          html += `<div class="row static text">${esc(q.stageJournal)}</div>`;
          for (const o of q.objectives) {
            html += `<div class="row static ${o.done ? 'done' : ''}">${o.done ? '[x]' : '[ ]'} ${esc(o.text)} (${o.progress}/${o.required})${o.optional ? ' *' : ''}</div>`;
          }
        }
        html += `<div class="hint">[J] close</div></div>`;
        break;
      }
      case 'perks': {
        const r2 = this.world.playerResources();
        html += `<div class="panel"><h2>Perks (${r2.perkPoints} point${r2.perkPoints === 1 ? '' : 's'})</h2>`;
        for (const p of this.world.perks()) {
          const cls = p.owned ? 'done' : p.available ? '' : 'dim';
          html += `<div class="row ${cls}" data-act="perk" data-id="${p.id}"><span>${esc(p.name)} (${p.skill} ${p.requiredSkillLevel})</span><span>${p.owned ? 'owned' : p.available ? 'take' : esc(p.reason)}</span></div>`;
          html += `<div class="row static dim">${esc(p.description)}</div>`;
        }
        html += `<div class="hint">[P] close</div></div>`;
        break;
      }
      case 'none':
        break;
    }
    return html;
  }

  private bindPanelClicks(): void {
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.onclick = () => {
        const act = el.dataset.act;
        const id = el.dataset.id ?? '';
        if (act === 'dlg') this.world.dialogueChoose(Number(el.dataset.i));
        else if (act === 'buy') this.world.shopBuy(id);
        else if (act === 'sell') this.world.shopSell(id);
        else if (act === 'perk') this.world.takePerk(id);
        else if (act === 'respawn') this.world.respawn();
        else if (act === 'item') {
          const it = this.world.playerInventory().find((x) => x.itemId === id);
          if (!it) return;
          if (it.kind === 'weapon' || it.kind === 'armor') this.world.equipItem(id);
          else if (it.kind === 'consumable') this.world.useItem(id);
        }
      };
    });
  }

  closeAll(): void {
    if (this.panel === 'dialogue') this.world.dialogueEnd();
    if (this.panel === 'shop') this.world.shopClose();
    this.panel = 'none';
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
