// The HUD + menus: resource bars, crosshair, interaction prompt, notification
// feed, dialogue panel, shop, inventory, journal, perks, and the death screen.
// Observes IWorld and submits intent through it; never resolves outcomes.

import type { ActorView, DialogueView, IWorld, PartyInviteView, PartyMemberView } from '../world_api';
import { DEFAULT_AUDIO_SETTINGS, type AudioBus, type AudioSettings } from '../game/combat_audio';
import { reticleDirection } from '../sim/player/aim';
import {
  LOADOUT_CSS,
  renderLoadoutPanel,
  renderLootPanel,
  renderMagicPanel,
  renderQuickbar,
  type InventoryCategory,
} from './loadout';
import { MENU_SHELL_CSS, renderMenuShell, type MenuDestination } from './menu_shell';
import {
  WORLD_MAP_CSS,
  mapDefinition,
  renderNavigationCue,
  renderWorldMap,
  type MapWaypoint,
} from './world_map';

const CSS = `
  #hud { position: fixed; inset: 0; pointer-events: none; font-family: Georgia, 'Times New Roman', serif; color: #e8e0cc; user-select: none; }
  #hud .bars { position: absolute; left: 24px; bottom: 24px; width: min(310px, calc(100vw - 48px)); padding: 12px 14px;
    background: linear-gradient(115deg, rgba(9,10,13,.88), rgba(18,16,13,.68)); border: 1px solid rgba(224,209,164,.38);
    border-radius: 6px; box-shadow: 0 4px 18px rgba(0,0,0,.45); box-sizing: border-box; }
  #hud .resource + .resource { margin-top: 9px; }
  #hud .resource-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 14px;
    line-height: 1.1; text-shadow: 0 1px 2px #000; }
  #hud .resource-label { font-weight: bold; letter-spacing: .035em; }
  #hud .resource-value { color: #f4eddb; font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 12px;
    font-variant-numeric: tabular-nums; }
  #hud .bar { height: 14px; margin-top: 5px; background: rgba(5,6,9,.82); border: 1px solid rgba(245,235,205,.42);
    border-radius: 3px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,.8); }
  #hud .bar > div { height: 100%; transition: width .12s; }
  #hud .resource--health .bar > div, #hud .hp > div { background-color: #a83b31;
    background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.13) 0 5px, transparent 5px 10px); }
  #hud .resource--stamina .bar > div { background-color: #4d843e;
    background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 2px, transparent 2px 8px); }
  #hud .resource--magicka .bar > div { background-color: #3c6398;
    background-image: radial-gradient(circle at 4px 4px, rgba(255,255,255,.22) 0 1px, transparent 1.5px); background-size: 8px 8px; }
  #hud .crosshair { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; transform: translate(-50%,-50%);
    border: 2px solid rgba(239,230,207,.92); border-radius: 50%; box-sizing: border-box; opacity: .9;
    box-shadow: 0 0 0 1px rgba(0,0,0,.75); transition: width .06s, height .06s, border-color .06s, box-shadow .06s; }
  #hud .crosshair--hit { width: 18px; height: 18px; border-color: #ffe08a; box-shadow: 0 0 8px rgba(255,205,80,.9); }
  #hud .crosshair--blocked { width: 18px; height: 18px; border-color: #8ed8ff; box-shadow: 0 0 8px rgba(85,180,255,.9); }
  #hud .crosshair--hurt { width: 16px; height: 16px; border-color: #ff7368; box-shadow: 0 0 9px rgba(255,45,35,.9); }
  #hud .damage-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 95px 28px rgba(155,12,8,.58); }
  #hud .target-frame { position: absolute; left: 50%; top: calc(50% + 26px); width: 260px; transform: translateX(-50%);
    padding: 6px 9px 8px; box-sizing: border-box; text-align: center; background: rgba(9,8,8,.76);
    border: 1px solid rgba(220,193,145,.48); border-radius: 4px; text-shadow: 0 1px 2px #000; }
  #hud .target-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 13px; }
  #hud .target-name { color: #f0dfb4; font-weight: bold; }
  #hud .target-tier { color: #c5b388; font-size: 10px; letter-spacing: .09em; text-transform: uppercase; }
  #hud .target-frame .bar { height: 9px; margin-top: 4px; }
  #hud .prompt { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 18px; text-shadow: 0 1px 3px #000; }
  #hud .feed { position: absolute; right: 24px; top: 24px; width: 320px; text-align: right; font-size: 14px; text-shadow: 0 1px 2px #000; }
  #hud .feed div { margin-bottom: 3px; opacity: .95; }
  #hud .clockrow { position: absolute; left: 24px; top: 18px; font-size: 14px; opacity: .85; text-shadow: 0 1px 2px #000; }
  #hud .connection-status { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); padding: 5px 10px;
    border: 1px solid rgba(220,205,165,.42); border-radius: 4px; background: rgba(10,11,13,.82); font: 12px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace;
    letter-spacing: .025em; text-shadow: 0 1px 2px #000; box-shadow: 0 2px 10px rgba(0,0,0,.32); }
  #hud .connection-status--pending { color: #ead49b; }
  #hud .connection-status--online { color: #9fd89f; border-color: rgba(126,205,139,.42); }
  #hud .connection-status--error { color: #ff9d90; border-color: rgba(224,99,84,.52); }
  #hud .panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); min-width: 420px; max-width: 620px; max-height: 70vh; overflow-y: auto;
    background: rgba(14,12,10,.93); border: 1px solid #8a7a55; border-radius: 6px; padding: 18px 22px; pointer-events: auto; box-shadow: 0 8px 40px #000; }
  #hud .panel h2 { margin: 0 0 10px; font-size: 20px; color: #d8c890; border-bottom: 1px solid #665533; padding-bottom: 6px; }
  #hud .panel .row { padding: 5px 8px; margin: 2px 0; border-radius: 3px; cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
  #hud .panel button.row { width: 100%; border: 0; color: inherit; background: transparent; font: inherit; text-align: left; }
  #hud .panel .row:hover { background: rgba(200,180,120,.15); }
  #hud .is-ui-selected { outline: 1px solid rgba(234,211,150,.72); outline-offset: 2px; }
  #hud [data-act].is-ui-selected { color: #fff6de; background: linear-gradient(90deg, rgba(214,184,112,.24), rgba(214,184,112,.06));
    outline-offset: -1px; }
  #hud [data-act]:focus { outline: none; }
  #hud .panel .row.static { cursor: default; }
  #hud .panel .dim { opacity: .55; }
  #hud .panel .speaker { font-style: italic; color: #c9b880; margin-bottom: 8px; }
  #hud .panel .text { line-height: 1.5; margin-bottom: 14px; }
  #hud .audio-control { display: grid; grid-template-columns: 90px minmax(180px, 1fr) 48px; align-items: center; gap: 12px;
    padding: 8px; }
  #hud .audio-control input[type="range"] { width: 100%; accent-color: #cdbd8d; }
  #hud .audio-value { font: 12px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace; text-align: right; }
  #hud .audio-mute { display: flex; align-items: center; gap: 9px; padding: 9px 8px; }
  #hud .audio-state { color: #cbbd98; padding: 5px 8px 10px; }
  #hud .hint { font-size: 12px; opacity: .6; margin-top: 10px; }
  #hud .death { position: absolute; inset: 0; background: rgba(20,0,0,.72); display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; }
  #hud .death h1 { font-size: 44px; color: #c9b880; }
  #hud .done { color: #7a9a5f; }
  #hud .partyframes { position: absolute; left: 24px; top: 52px; width: 180px; }
  #hud .pmember { margin-bottom: 8px; font-size: 13px; text-shadow: 0 1px 2px #000; }
  #hud .pmember .bar { height: 8px; margin-top: 2px; }
  #hud .pdowntag { color: #d05040; font-weight: bold; }
  #hud .pdown span { opacity: .7; }
  #hud .poffline { opacity: .58; }
  #hud .social-status { color: #cbbd98; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  #hud .chat-compose { position: absolute; left: 50%; bottom: 28px; width: min(580px, calc(100vw - 48px)); transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px; padding: 9px 11px; box-sizing: border-box; pointer-events: auto;
    background: rgba(10,10,12,.94); border: 1px solid rgba(218,198,142,.62); border-radius: 5px; box-shadow: 0 5px 24px rgba(0,0,0,.62); }
  #hud .chat-compose label { color: #d8c890; font-size: 13px; font-weight: bold; }
  #hud .chat-compose input { flex: 1; min-width: 0; padding: 7px 9px; color: #f4eddb; background: rgba(3,4,6,.82);
    border: 1px solid rgba(230,216,174,.42); border-radius: 3px; outline: none; font: 14px/1.25 Georgia, 'Times New Roman', serif; user-select: text; }
  #hud .chat-compose input:focus { border-color: #d8c890; box-shadow: 0 0 0 2px rgba(216,200,144,.16); }
  #hud .chat-compose .hint { margin: 0; white-space: nowrap; }
  #hud .chat-send { padding: 6px 9px; color: #f4eddb; background: rgba(104,91,61,.52); border: 1px solid rgba(225,207,157,.5);
    border-radius: 3px; font: 12px/1.2 ui-monospace, 'Cascadia Mono', Consolas, monospace; cursor: pointer; }
  #hud .help-card { position: absolute; right: 24px; bottom: 24px; width: min(370px, calc(100vw - 48px)); padding: 14px 16px 15px;
    box-sizing: border-box; background: linear-gradient(145deg, rgba(13,13,15,.94), rgba(27,23,18,.9));
    border: 1px solid rgba(218,198,142,.55); border-radius: 6px; box-shadow: 0 5px 24px rgba(0,0,0,.55);
    text-shadow: 0 1px 2px #000; }
  #hud .help-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(218,198,142,.3); }
  #hud .help-head strong { color: #e4d39d; font-size: 17px; letter-spacing: .04em; }
  #hud .help-head span { color: #c9bea0; font-size: 12px; }
  #hud .look-hint { margin: 10px 0 11px; color: #fff8e5; font-size: 14px; line-height: 1.35; }
  #hud .control-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
  #hud .control-group h3 { margin: 0 0 5px; color: #cdbd8d; font-size: 12px; font-weight: normal; letter-spacing: .1em;
    text-transform: uppercase; }
  #hud .control-row { display: grid; grid-template-columns: minmax(58px, auto) 1fr; align-items: center; gap: 8px; min-height: 24px;
    color: #e9e1ce; font-size: 13px; }
  #hud kbd { display: inline-block; min-width: 18px; padding: 2px 5px; box-sizing: border-box; color: #fff8e3;
    background: rgba(104,91,61,.52); border: 1px solid rgba(225,207,157,.5); border-radius: 3px;
    box-shadow: inset 0 -1px 0 rgba(0,0,0,.45); font: 11px/1.25 ui-monospace, 'Cascadia Mono', Consolas, monospace; text-align: center; }
  #hud .help-toggle { position: absolute; right: 24px; bottom: 24px; padding: 8px 11px; color: #eee4c9;
    background: rgba(12,12,14,.86); border: 1px solid rgba(218,198,142,.45); border-radius: 5px; box-shadow: 0 3px 12px rgba(0,0,0,.42);
    font-size: 13px; text-shadow: 0 1px 2px #000; }
  @media (max-height: 760px) {
    #hud .help-card { padding: 11px 14px 12px; }
    #hud .look-hint { margin: 8px 0; }
    #hud .control-grid { gap: 7px 15px; }
    #hud .control-row { min-height: 21px; }
  }
  ${LOADOUT_CSS}
  ${MENU_SHELL_CSS}
  ${WORLD_MAP_CSS}
`;

type Panel = 'none' | 'dialogue' | 'shop' | 'loot' | MenuDestination;
type ResourceKind = 'health' | 'stamina' | 'magicka';
type ResourceReadout = Pick<
  ReturnType<IWorld['playerResources']>,
  'health' | 'maxHealth' | 'stamina' | 'maxStamina' | 'magicka' | 'maxMagicka'
>;

export interface AudioSettingsController {
  settings(): AudioSettings;
  setSettings(settings: Partial<AudioSettings>): void;
  state(): AudioContextState | 'locked';
}

export class Hud {
  private root: HTMLDivElement;
  private passiveRoot: HTMLDivElement;
  private interactionRoot: HTMLDivElement;
  private feedLines: { text: string; until: number }[] = [];
  private controlsOpen = true;
  private combatPulse: 'hit' | 'blocked' | 'hurt' | null = null;
  private combatPulseUntil = 0;
  private connectionStatus: { text: string; tone: 'pending' | 'online' | 'error' } | null = null;
  private chatOpen = false;
  private chatDraft = '';
  private waypoint: MapWaypoint | null = null;
  private inventoryCategory: InventoryCategory = 'all';
  private selectedInventoryItem = '';
  private selectedLootItem = '';
  private renderedPassiveHtml = '';
  private renderedInteractionSignature = '';
  private selectedUiKey = '';
  private keyboardUiFocus = false;
  panel: Panel = 'none';
  private time = 0;

  constructor(
    private world: IWorld,
    private eventObserver?: (events: ReturnType<IWorld['drainEvents']>) => void,
    private audio?: AudioSettingsController,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.passiveRoot = document.createElement('div');
    this.passiveRoot.dataset.hudLayer = 'passive';
    this.interactionRoot = document.createElement('div');
    this.interactionRoot.dataset.hudLayer = 'interaction';
    this.root.append(this.passiveRoot, this.interactionRoot);
    document.body.appendChild(this.root);
  }

  notify(text: string): void {
    this.feedLines.push({ text, until: this.time + 5 });
    if (this.feedLines.length > 8) this.feedLines.shift();
  }

  setConnectionStatus(
    text: string | null,
    tone: 'pending' | 'online' | 'error' = 'pending',
  ): void {
    this.connectionStatus = text ? { text, tone } : null;
  }

  togglePanel(p: Panel): void {
    this.chatOpen = false;
    this.panel = this.panel === p ? 'none' : p;
    this.selectedUiKey = '';
    this.keyboardUiFocus = false;
    if (this.panel !== 'none') void document.exitPointerLock?.();
  }

  toggleControls(): void {
    this.controlsOpen = !this.controlsOpen;
  }

  toggleSettings(): void {
    this.togglePanel('settings');
    if (this.panel === 'settings') void document.exitPointerLock?.();
  }

  toggleMap(): void {
    this.togglePanel('map');
    if (this.panel === 'map') void document.exitPointerLock?.();
  }

  isMenuOpen(): boolean {
    return this.panel !== 'none';
  }

  isInputCaptured(): boolean {
    return this.panel !== 'none' || this.chatOpen || this.world.playerDowned();
  }

  openChat(): void {
    if (this.panel !== 'none' || this.world.playerDowned()) return;
    this.chatOpen = true;
    void document.exitPointerLock?.();
  }

  update(dtSec: number): void {
    this.time += dtSec;
    if (this.combatPulseUntil <= this.time) this.combatPulse = null;
    const selfId = this.world.player().id;
    // One authoritative drain fans out to presentation observers before the
    // HUD translates the same events into visual feedback.
    const events = this.world.drainEvents();
    this.eventObserver?.(events);
    for (const e of events) {
      switch (e.type) {
        case 'damage':
          if (e.targetId === selfId) {
            this.combatPulse = e.blocked ? 'blocked' : 'hurt';
            this.combatPulseUntil = this.time + (e.blocked ? 0.16 : 0.24);
          } else if (e.sourceId === selfId) {
            this.combatPulse = e.blocked ? 'blocked' : 'hit';
            this.combatPulseUntil = this.time + 0.16;
          }
          break;
        case 'actionRejected':
          if (e.actorId === selfId) this.notify(actionRejectionText(e.action, e.reason));
          break;
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
        case 'spellLearned':
          this.notify(`Spell learned: ${titleFromId(e.spellId)}`);
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
        case 'playerReleased':
          this.notify('Companion released to the recovery point');
          break;
        case 'playerRecovered':
          if (e.playerId === selfId) this.notify('Returned to safe ground');
          break;
        case 'recoveryRejected':
          if (e.playerId === selfId) this.notify(recoveryRejectionText(e.reason, e.secondsRemaining));
          break;
        case 'partyStatus':
          this.notify(e.text);
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
    const authoritativePanel = this.world.lootView()
      ? 'loot'
      : this.world.dialogueView()
        ? 'dialogue'
        : this.world.shopView()
          ? 'shop'
          : null;
    if (authoritativePanel && this.panel !== authoritativePanel) {
      this.panel = authoritativePanel;
      this.selectedUiKey = '';
    } else if (!authoritativePanel && (this.panel === 'dialogue' || this.panel === 'shop' || this.panel === 'loot')) {
      this.panel = 'none';
      this.selectedUiKey = '';
    }

    const passiveHtml = this.renderPassiveHtml();
    if (passiveHtml !== this.renderedPassiveHtml) {
      this.renderedPassiveHtml = passiveHtml;
      this.passiveRoot.innerHTML = passiveHtml;
    }
    const interaction = this.interactionSignature();
    if (interaction !== this.renderedInteractionSignature) {
      const dialogueNodeChanged = this.panel === 'dialogue'
        && this.renderedInteractionSignature.startsWith('{"panel":"dialogue"');
      if (dialogueNodeChanged) this.selectedUiKey = '';
      this.renderedInteractionSignature = interaction;
      this.interactionRoot.innerHTML = this.renderInteractionHtml();
      this.bindPanelClicks();
      this.restoreUiSelection();
      if (this.chatOpen) {
        const input = this.interactionRoot.querySelector<HTMLInputElement>('[data-chat-input]');
        input?.focus({ preventScroll: true });
        input?.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (this.panel === 'settings') {
      const state = this.interactionRoot.querySelector<HTMLElement>('[data-audio-state]');
      if (state) state.textContent = audioStateText(this.audio?.state() ?? 'locked');
    }
    const downedCountdown = this.interactionRoot.querySelector<HTMLElement>('[data-downed-countdown]');
    if (downedCountdown) downedCountdown.textContent = String(Math.ceil(this.world.downedTicksLeft() / 30));
  }

  private questName(id: string): string {
    return this.world.journal().find((j) => j.questId === id)?.name ?? id;
  }

  private interactionSignature(): string {
    if (this.chatOpen) return 'chat';
    if (this.world.playerDowned()) return 'downed';
    switch (this.panel) {
      case 'dialogue':
        return JSON.stringify({ panel: 'dialogue', view: this.world.dialogueView() });
      case 'shop':
        return JSON.stringify({ panel: 'shop', view: this.world.shopView(), gold: this.world.playerResources().gold });
      case 'loot':
        return JSON.stringify({ panel: 'loot', view: this.world.lootView(), selected: this.selectedLootItem });
      case 'inventory':
        return JSON.stringify({
          panel: 'inventory', category: this.inventoryCategory, selected: this.selectedInventoryItem,
          equipment: this.world.playerEquipment(), inventory: this.world.playerInventory(),
          consumables: this.world.equippedConsumables(), spells: this.world.equippedSpells(),
        });
      case 'magic':
        return JSON.stringify({ panel: 'magic', equipped: this.world.equippedSpells(), known: this.world.knownSpells() });
      case 'journal':
        return JSON.stringify({ panel: 'journal', quests: this.world.journal() });
      case 'perks':
        return JSON.stringify({ panel: 'perks', perks: this.world.perks(), points: this.world.playerResources().perkPoints });
      case 'social': {
        const nearby = this.world.actorsInSpace()
          .filter((actor) => actor.isRemotePlayer)
          .map((actor) => ({ id: actor.id, name: actor.name }));
        return JSON.stringify({
          panel: 'social', partyId: this.world.partyId(), party: this.world.party(),
          invites: this.world.partyInvites(), nearby,
        });
      }
      case 'map':
        return JSON.stringify({ panel: 'map', space: this.world.currentSpace(), waypoint: this.waypoint });
      case 'settings':
        return 'settings';
      case 'none':
        return 'none';
    }
  }

  private renderPassiveHtml(): string {
    const r = this.world.playerResources();
    const player = this.world.player();
    const spaceName = this.world.spaceName(this.world.currentSpace());
    const hour = this.world.gameHours() % 24;
    const hh = String(Math.floor(hour)).padStart(2, '0');
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0');
    const prompt = this.world.nearestInteractablePrompt();
    const target = selectCombatTarget(player, this.world.actorsInSpace());
    const pulseClass = this.combatPulse ? ` crosshair--${this.combatPulse}` : '';
    let html = `
      <div class="clockrow">${esc(spaceName)} - ${hh}:${mm} - Level ${r.level} - ${r.gold} gold</div>
      ${this.connectionStatus ? `<div class="connection-status connection-status--${this.connectionStatus.tone}" role="status">${esc(this.connectionStatus.text)}</div>` : ''}
      ${renderResourceMeters(r)}
      ${renderQuickbar(this.world.equippedSpells(), this.world.equippedConsumables())}
      <div class="crosshair${pulseClass}" aria-hidden="true"></div>
      ${target ? renderCombatTarget(target) : ''}
      ${this.combatPulse === 'hurt' ? '<div class="damage-vignette" aria-hidden="true"></div>' : ''}
      <div class="feed" aria-live="polite" aria-atomic="false">${this.feedLines.map((l) => `<div>${esc(l.text)}</div>`).join('')}</div>
    `;
    if (this.waypoint?.spaceId === this.world.currentSpace()) html += renderNavigationCue(player, this.waypoint);
    if (this.panel === 'none' && !this.chatOpen) html += renderControlsHelp(this.controlsOpen);
    if (prompt && this.panel === 'none') html += `<div class="prompt">[E] ${esc(prompt)}</div>`;
    // Party frames (multiplayer presence).
    const party = this.world.party();
    if (party.length > 1) {
      html += `<div class="partyframes">`;
      for (const m of party) {
        if (m.isSelf) continue;
        html += `<div class="pmember${m.downed ? ' pdown' : ''}${m.online ? '' : ' poffline'}"><span>${esc(m.name)}${m.online ? '' : ' (offline)'}</span><div class="bar hp"><div style="width:${resourcePercent(m.health, m.maxHealth).toFixed(2)}%"></div></div>${m.downed ? '<span class="pdowntag">DOWN</span>' : ''}</div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  private renderInteractionHtml(): string {
    const r = this.world.playerResources();
    const player = this.world.player();
    let html = '';
    if (this.chatOpen) html += renderChatComposer(this.chatDraft, 400);
    if (this.world.playerDowned()) {
      html += `<div class="death"><h1>You are down.</h1><div class="row static">A party member can revive you. Auto-release in <span data-downed-countdown></span>s.</div><button type="button" class="row" data-act="respawn">Release now</button></div>`;
      return html;
    }
    switch (this.panel) {
      case 'dialogue': {
        const d = this.world.dialogueView();
        if (d) html += renderDialoguePanel(d);
        break;
      }
      case 'shop': {
        const s = this.world.shopView();
        if (s) {
          let trade = `<div class="section-panel"><h2>${esc(s.merchantName)} - Trade</h2>`;
          trade += `<div class="row static dim">Buy:</div>`;
          trade += s.stock
            .map((it) => `<button type="button" class="row" data-act="buy" data-id="${it.itemId}"><span>${esc(it.name)} x${it.count}</span><span>${it.price}g</span></button>`)
            .join('');
          trade += `<div class="row static dim">Sell:</div>`;
          trade += s.sellable
            .map((it) => `<button type="button" class="row" data-act="sell" data-id="${it.itemId}"><span>${esc(it.name)} x${it.count}</span><span>${it.price}g</span></button>`)
            .join('');
          trade += `</div>`;
          html += renderMenuShell('inventory', 'Trade', trade, `${r.gold} gold`, '<kbd>Esc</kbd> close trade');
        }
        break;
      }
      case 'loot': {
        const loot = this.world.lootView();
        if (loot) html += renderLootPanel(loot, this.selectedLootItem);
        break;
      }
      case 'inventory': {
        const content = renderLoadoutPanel(
          this.world.playerResources().gold,
          this.world.playerEquipment(),
          this.world.equippedSpells(),
          this.world.knownSpells(),
          this.world.playerInventory(),
          this.world.equippedConsumables(),
          this.inventoryCategory,
          this.selectedInventoryItem,
        );
        html += renderMenuShell('inventory', 'Inventory', content, `${r.gold} gold`);
        break;
      }
      case 'magic': {
        html += renderMenuShell('magic', 'Magic', renderMagicPanel(this.world.equippedSpells(), this.world.knownSpells()), `${r.magicka.toFixed(0)} magicka`);
        break;
      }
      case 'journal': {
        const quests = this.world.journal();
        let journal = `<div class="section-panel"><h2>Journal</h2>`;
        if (quests.length === 0) journal += `<div class="row static dim">No quests yet. Someone in Fenharrow may need help.</div>`;
        for (const q of quests) {
          journal += `<div class="row static"><b>${esc(q.name)}${q.completed ? ' (done)' : ''}</b></div>`;
          journal += `<div class="row static text">${esc(q.stageJournal)}</div>`;
          for (const o of q.objectives) {
            journal += `<div class="row static ${o.done ? 'done' : ''}">${o.done ? '[x]' : '[ ]'} ${esc(o.text)} (${o.progress}/${o.required})${o.optional ? ' *' : ''}</div>`;
          }
        }
        journal += `</div>`;
        html += renderMenuShell('journal', 'Journal', journal, `${quests.filter((q) => !q.completed).length} active`);
        break;
      }
      case 'perks': {
        const r2 = this.world.playerResources();
        let character = `<div class="section-panel"><h2>Character Development</h2>`;
        for (const p of this.world.perks()) {
          const cls = p.owned ? 'done' : p.available ? '' : 'dim';
          character += `<button type="button" class="row ${cls}" data-act="perk" data-id="${p.id}"${p.available && !p.owned ? '' : ' disabled'}><span>${esc(p.name)} (${p.skill} ${p.requiredSkillLevel})</span><span>${p.owned ? 'owned' : p.available ? 'take' : esc(p.reason)}</span></button>`;
          character += `<div class="row static dim">${esc(p.description)}</div>`;
        }
        character += `</div>`;
        html += renderMenuShell('perks', 'Character', character, `${r2.perkPoints} perk point${r2.perkPoints === 1 ? '' : 's'}`);
        break;
      }
      case 'social':
        html += renderMenuShell('social', 'Social', renderSocialPanel(
          this.world.partyId(),
          this.world.party(),
          this.world.partyInvites(),
          this.world.actorsInSpace(),
        ), this.world.partyId() ? `${this.world.party().length} party members` : 'Travelling solo');
        break;
      case 'map':
        html += renderMenuShell('map', 'World Map', renderWorldMap(
          mapDefinition(this.world.currentSpace()),
          player,
          this.waypoint?.spaceId === this.world.currentSpace() ? this.waypoint : null,
        ), this.world.spaceName(this.world.currentSpace()));
        break;
      case 'settings':
        html += renderMenuShell('settings', 'System', renderSettings(this.audio?.settings() ?? DEFAULT_AUDIO_SETTINGS, this.audio?.state() ?? 'locked'));
        break;
      case 'none':
        break;
    }
    return html;
  }

  private bindPanelClicks(): void {
    this.interactionRoot.querySelectorAll<HTMLElement>('[data-act]').forEach((el, index) => {
      el.dataset.uiKey = uiElementKey(el, index);
      el.onclick = () => {
        const act = el.dataset.act;
        const id = el.dataset.id ?? '';
        if (act === 'dlg') this.world.dialogueChoose(Number(el.dataset.i));
        else if (act === 'buy') this.world.shopBuy(id);
        else if (act === 'sell') this.world.shopSell(id);
        else if (act === 'perk') this.world.takePerk(id);
        else if (act === 'respawn') this.world.respawn();
        else if (act === 'recover') {
          this.world.recover();
          // Leave the interaction-stable settings surface so authoritative
          // success/rejection feedback renders immediately on the HUD.
          this.panel = 'none';
        }
        else if (act === 'party-invite') this.world.partyInvite(Number(el.dataset.target));
        else if (act === 'party-accept') this.world.partyAccept();
        else if (act === 'party-decline') this.world.partyDecline();
        else if (act === 'party-leave') this.world.partyLeave();
        else if (act === 'map-waypoint') {
          const map = mapDefinition(this.world.currentSpace());
          const landmark = map.landmarks.find((candidate) => candidate.id === id);
          if (landmark) {
            this.waypoint = landmark;
            this.panel = 'none';
            this.notify(`Destination marked: ${landmark.name}`);
          }
        }
        else if (act === 'map-clear') this.waypoint = null;
        else if (act === 'menu-nav') {
          if (this.panel === 'shop') this.world.shopClose();
          this.panel = el.dataset.panel as MenuDestination;
          void document.exitPointerLock?.();
        }
        else if (act === 'inventory-category') {
          this.inventoryCategory = el.dataset.category as InventoryCategory;
          this.selectedInventoryItem = '';
        }
        else if (act === 'select-item') this.selectedInventoryItem = id;
        else if (act === 'select-loot') this.selectedLootItem = id;
        else if (act === 'loot-take') this.world.lootTake(id);
        else if (act === 'loot-all') this.world.lootTakeAll();
        else if (act === 'unequip-item') this.world.unequipItem(el.dataset.slot as Parameters<IWorld['unequipItem']>[0]);
        else if (act === 'equip-spell') this.world.equipSpell(el.dataset.slot as Parameters<IWorld['equipSpell']>[0], id);
        else if (act === 'unequip-spell') this.world.unequipSpell(el.dataset.slot as Parameters<IWorld['unequipSpell']>[0]);
        else if (act === 'equip-consumable') this.world.equipConsumable(el.dataset.slot as Parameters<IWorld['equipConsumable']>[0], id);
        else if (act === 'item') {
          this.activateInventoryItem(id);
        }
      };
    });
    this.interactionRoot.querySelectorAll<HTMLElement>('[data-act], [data-audio], [data-audio-mute]').forEach((element, index) => {
      element.dataset.uiKey ||= uiElementKey(element, index);
      element.tabIndex = -1;
      element.onpointerenter = () => this.selectUiElement(element, false, true);
    });
    const input = this.interactionRoot.querySelector<HTMLInputElement>('[data-chat-input]');
    const form = this.interactionRoot.querySelector<HTMLFormElement>('[data-chat-form]');
    if (input) input.oninput = () => {
      const bounded = [...input.value].slice(0, 200).join('');
      if (bounded !== input.value) input.value = bounded;
      this.chatDraft = bounded;
    };
    if (form) {
      const submitChat = () => {
        const message = this.chatDraft.trim();
        if (message) this.world.chat(message);
        this.chatDraft = '';
        this.chatOpen = false;
      };
      form.onsubmit = (event) => {
        event.preventDefault();
        submitChat();
      };
      form.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          submitChat();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.chatDraft = '';
          this.chatOpen = false;
        }
      };
    }
    this.interactionRoot.querySelectorAll<HTMLInputElement>('[data-audio]').forEach((input) => {
      input.oninput = () => {
        const bus = input.dataset.audio as AudioBus | 'master';
        const value = Math.max(0, Math.min(1, Number(input.value) / 100));
        this.audio?.setSettings({ [bus]: value });
        const output = this.interactionRoot.querySelector<HTMLOutputElement>(`[data-audio-value="${bus}"]`);
        if (output) output.value = `${Math.round(value * 100)}%`;
      };
    });
    const mute = this.interactionRoot.querySelector<HTMLInputElement>('[data-audio-mute]');
    if (mute) mute.onchange = () => this.audio?.setSettings({ muted: mute.checked });
  }

  private activateInventoryItem(id: string): void {
    const item = this.world.playerInventory().find((candidate) => candidate.itemId === id);
    if (!item) return;
    if (item.kind === 'weapon' || item.kind === 'armor') this.world.equipItem(id);
    else if (item.kind === 'consumable' || item.kind === 'tome') this.world.useItem(id);
  }

  private navigableElements(): HTMLElement[] {
    return [...this.interactionRoot.querySelectorAll<HTMLElement>('[data-act], [data-audio], [data-audio-mute]')]
      .filter((element) => !(element instanceof HTMLButtonElement && element.disabled))
      .filter((element) => element.getClientRects().length > 0);
  }

  private preferredUiElement(elements = this.navigableElements()): HTMLElement | null {
    const retained = elements.find((element) => element.dataset.uiKey === this.selectedUiKey);
    if (retained) return retained;
    const preferredAction = this.panel === 'dialogue'
      ? 'dlg'
      : this.panel === 'loot'
        ? 'select-loot'
        : this.panel === 'inventory'
          ? 'select-item'
          : this.panel === 'shop'
            ? 'buy'
            : null;
    return (preferredAction ? elements.find((element) => element.dataset.act === preferredAction) : null)
      ?? elements.find((element) => element.closest('.menu-content'))
      ?? elements[0]
      ?? null;
  }

  private selectUiElement(element: HTMLElement, focus: boolean, pointer = false): void {
    for (const candidate of this.interactionRoot.querySelectorAll<HTMLElement>('.is-ui-selected')) {
      if (candidate !== element) candidate.classList.remove('is-ui-selected');
    }
    this.selectedUiKey = element.dataset.uiKey ?? '';
    if (focus) this.keyboardUiFocus = true;
    else if (pointer) this.keyboardUiFocus = false;
    element.classList.add('is-ui-selected');
    const id = element.dataset.id ?? '';
    if (element.dataset.act === 'select-item' && id !== this.selectedInventoryItem) this.selectedInventoryItem = id;
    if (element.dataset.act === 'select-loot' && id !== this.selectedLootItem) this.selectedLootItem = id;
    if (focus) {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'nearest' });
    }
  }

  private restoreUiSelection(): void {
    const preferred = this.preferredUiElement();
    if (preferred) this.selectUiElement(preferred, this.keyboardUiFocus);
  }

  /** W/S or arrow-key navigation for the currently captured interaction. */
  handleUiMoveCommand(delta: -1 | 1): boolean {
    if (!this.isInputCaptured() || this.chatOpen) return false;
    const elements = this.navigableElements();
    if (elements.length === 0) return false;
    let current = elements.findIndex((element) => element.dataset.uiKey === this.selectedUiKey);
    if (current < 0) {
      const preferred = this.preferredUiElement(elements);
      current = preferred ? elements.indexOf(preferred) : 0;
    }
    const next = boundedUiSelectionIndex(current, elements.length, delta);
    this.selectUiElement(elements[next], true);
    return true;
  }

  /** Enter activates the logical selection without depending on a live mouse
   * click target. Inventory and loot rows use their contextual primary action. */
  handleUiAcceptCommand(): boolean {
    if (!this.isInputCaptured() || this.chatOpen) return false;
    const elements = this.navigableElements();
    const selected = this.preferredUiElement(elements);
    if (!selected) return false;
    this.selectUiElement(selected, true);
    const id = selected.dataset.id ?? '';
    if (selected.dataset.act === 'select-item') this.activateInventoryItem(id);
    else if (selected.dataset.act === 'select-loot') this.world.lootTake(id);
    else selected.click();
    return true;
  }

  closeAll(): void {
    if (this.panel === 'dialogue') this.world.dialogueEnd();
    if (this.panel === 'shop') this.world.shopClose();
    if (this.panel === 'loot') this.world.lootClose();
    this.panel = 'none';
    this.chatOpen = false;
    this.chatDraft = '';
    this.selectedUiKey = '';
    this.keyboardUiFocus = false;
  }

  /** Keyboard E takes the selected loot stack while a loot surface is open. */
  handleInteractCommand(): boolean {
    if (this.panel !== 'loot') return false;
    const loot = this.world.lootView();
    const selected = loot?.items.find((item) => item.itemId === this.selectedLootItem) ?? loot?.items[0];
    if (selected) this.world.lootTake(selected.itemId);
    return true;
  }

  handleLootAllCommand(): boolean {
    if (this.panel !== 'loot') return false;
    this.world.lootTakeAll();
    return true;
  }
}

export function boundedUiSelectionIndex(current: number, count: number, delta: -1 | 1): number {
  if (!Number.isFinite(count) || count <= 0) return -1;
  const boundedCurrent = Number.isFinite(current) ? Math.max(0, Math.min(count - 1, Math.trunc(current))) : 0;
  return Math.max(0, Math.min(count - 1, boundedCurrent + delta));
}

function uiElementKey(element: HTMLElement, index: number): string {
  const data = element.dataset;
  const identity = data.id ?? data.i ?? data.slot ?? data.category ?? data.panel ?? data.target ?? String(index);
  return `${data.act ?? 'control'}:${identity}`;
}

export function renderDialoguePanel(dialogue: DialogueView): string {
  const choices = dialogue.choices.map((choice, index) =>
    `<button type="button" class="row" data-act="dlg" data-i="${index}">${esc(choice)}</button>`
  ).join('');
  return `<section class="panel" role="dialog" aria-label="Dialogue with ${esc(dialogue.speakerName)}">` +
    `<div class="speaker">${esc(dialogue.speakerName)}</div><div class="text">${esc(dialogue.text)}</div>${choices}` +
    `<div class="hint"><kbd>W</kbd>/<kbd>S</kbd> select · <kbd>Enter</kbd> choose · <kbd>Esc</kbd> leave</div></section>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function titleFromId(id: string): string {
  return id.split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function actionRejectionText(
  action: 'melee' | 'ranged' | 'spell',
  reason: 'busy' | 'stamina' | 'weapon' | 'ammo' | 'magicka' | 'unknown' | 'incapacitated',
): string {
  if (reason === 'stamina') return 'Not enough stamina';
  if (reason === 'magicka') return 'Not enough magicka';
  if (reason === 'ammo') return 'No arrows';
  if (reason === 'weapon') return 'Equip a bow to use a ranged attack';
  if (reason === 'incapacitated') return 'You cannot act while downed';
  if (reason === 'unknown') return 'That spell is not known';
  return `${action === 'spell' ? 'Spell' : 'Attack'} is already committed`;
}

export function selectCombatTarget(
  player: ActorView,
  actors: readonly ActorView[],
  maxDistance = 20,
): ActorView | null {
  const forward = reticleDirection(player.yaw, player.aimPitch);
  const minDot = Math.cos((22 * Math.PI) / 180);
  let best: ActorView | null = null;
  let bestScore = -Infinity;
  for (const actor of actors) {
    if (!actor.hostileToPlayer || actor.dead || actor.downed || actor.id === player.id) continue;
    const dx = actor.x - player.x;
    const dy = actor.y + 1.2 - (player.y + 1.4);
    const dz = actor.z - player.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.01 || distance > maxDistance) continue;
    const dot = (dx / distance) * forward.x + (dy / distance) * forward.y + (dz / distance) * forward.z;
    if (dot < minDot) continue;
    const score = dot * 10 - distance / maxDistance;
    if (score > bestScore) {
      best = actor;
      bestScore = score;
    }
  }
  return best;
}

export function renderCombatTarget(target: ActorView): string {
  const current = Math.max(0, Math.round(target.health));
  const maximum = Math.max(1, Math.round(target.maxHealth));
  const percent = resourcePercent(target.health, target.maxHealth);
  return `<section class="target-frame" aria-label="Combat target">
    <div class="target-head"><span class="target-name">${esc(target.name)}</span><span class="target-tier">${esc(target.tier)}</span></div>
    <div class="bar hp" role="meter" aria-label="${esc(target.name)} health" aria-valuemin="0" aria-valuemax="${maximum}"
      aria-valuenow="${Math.min(current, maximum)}" aria-valuetext="${Math.min(current, maximum)} of ${maximum}">
      <div style="width:${percent.toFixed(2)}%"></div>
    </div>
  </section>`;
}

export function resourcePercent(current: number, maximum: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, (100 * current) / maximum));
}

function displayResource(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function renderResourceMeter(kind: ResourceKind, current: number, maximum: number): string {
  const label = kind[0].toUpperCase() + kind.slice(1);
  const maxDisplay = Math.max(1, displayResource(maximum));
  const currentDisplay = Math.min(maxDisplay, displayResource(current));
  const percent = resourcePercent(current, maximum);
  return `
    <div class="resource resource--${kind}" role="meter" aria-label="${label}" aria-valuemin="0"
      aria-valuemax="${maxDisplay}" aria-valuenow="${currentDisplay}" aria-valuetext="${currentDisplay} of ${maxDisplay}">
      <div class="resource-head"><span class="resource-label">${label}</span><span class="resource-value">${currentDisplay} / ${maxDisplay}</span></div>
      <div class="bar" aria-hidden="true"><div style="width:${percent.toFixed(2)}%"></div></div>
    </div>`;
}

export function renderResourceMeters(resources: ResourceReadout): string {
  return `<div class="bars" aria-label="Player resources">
    ${renderResourceMeter('health', resources.health, resources.maxHealth)}
    ${renderResourceMeter('stamina', resources.stamina, resources.maxStamina)}
    ${renderResourceMeter('magicka', resources.magicka, resources.maxMagicka)}
  </div>`;
}

export function renderChatComposer(draft: string, maxLength: number): string {
  return `<form class="chat-compose" data-chat-form aria-label="Nearby chat">
    <label for="claurim-chat">Say</label>
    <input id="claurim-chat" data-chat-input type="text" aria-label="Chat message" autocomplete="off"
      maxlength="${maxLength}" value="${esc(draft)}" />
    <button class="chat-send" type="submit">Send</button>
    <span class="hint"><kbd>Enter</kbd> send · <kbd>Esc</kbd> cancel</span>
  </form>`;
}

export function renderAudioSettings(
  settings: AudioSettings,
  state: AudioContextState | 'locked',
): string {
  return `<section class="panel" aria-label="Audio settings">${renderAudioControls(settings, state)}` +
    `<div class="hint"><kbd>Esc</kbd> close · settings persist in this browser</div></section>`;
}

function renderAudioControls(
  settings: AudioSettings,
  state: AudioContextState | 'locked',
): string {
  const controls: Array<{ bus: 'master' | AudioBus; label: string }> = [
    { bus: 'master', label: 'Master' },
    { bus: 'effects', label: 'Effects' },
    { bus: 'ambience', label: 'Ambience' },
    { bus: 'music', label: 'Music' },
  ];
  let html = '<h2>Audio</h2>';
  for (const { bus, label } of controls) {
    const percent = Math.round(settings[bus] * 100);
    html += `<label class="audio-control"><span>${label}</span>` +
      `<input data-audio="${bus}" type="range" min="0" max="100" step="1" value="${percent}" aria-label="${label} volume" />` +
      `<output class="audio-value" data-audio-value="${bus}">${percent}%</output></label>`;
  }
  html += `<label class="audio-mute"><input data-audio-mute type="checkbox"${settings.muted ? ' checked' : ''} /> Mute all audio</label>`;
  html += `<div class="audio-state" data-audio-state role="status">${esc(audioStateText(state))}</div>`;
  return html;
}

export function renderSettings(
  settings: AudioSettings,
  state: AudioContextState | 'locked',
): string {
  return `<section class="panel" aria-label="Game settings"><div aria-label="Audio settings">${renderAudioControls(settings, state)}</div>` +
    `<section aria-label="Player recovery"><h2>Recovery</h2>` +
    `<p class="text">If terrain or geometry traps your character, return to this space's safe recovery point. ` +
    `Unavailable during combat and limited to once every 30 seconds.</p>` +
    `<button type="button" class="row" data-act="recover"><span>Return to safe ground</span></button>` +
    `<div class="hint"><kbd>Esc</kbd> close · settings persist in this browser</div></section></section>`;
}

function audioStateText(state: AudioContextState | 'locked'): string {
  return state === 'locked'
    ? 'Audio unlocks after keyboard or pointer input.'
    : state === 'running'
      ? 'Audio active.'
      : `Audio ${state}. Interact with the game to resume.`;
}

function recoveryRejectionText(
  reason: 'incapacitated' | 'combat' | 'cooldown',
  secondsRemaining: number,
): string {
  if (reason === 'combat') return 'Cannot recover while enemies are nearby';
  if (reason === 'cooldown') return `Recovery available in ${Math.max(1, secondsRemaining)}s`;
  return 'Cannot recover while incapacitated';
}

export function renderSocialPanel(
  partyId: string | null,
  members: readonly PartyMemberView[],
  invites: readonly PartyInviteView[],
  actors: readonly ActorView[],
): string {
  const memberEntities = new Set(members.flatMap((member) => member.entityId === null ? [] : [member.entityId]));
  const nearby = actors.filter((actor) => actor.isRemotePlayer && !memberEntities.has(actor.id));
  let html = `<div class="panel" aria-label="Party controls"><h2>Party</h2>`;
  html += `<div class="row static social-status">${partyId ? `${members.length} / 5 members` : 'Travelling solo'}</div>`;
  for (const invite of invites) {
    html += `<div class="row static"><span>${esc(invite.fromName)} invited you</span><span>` +
      `<button data-act="party-accept">Accept</button> <button data-act="party-decline">Decline</button></span></div>`;
  }
  html += `<div class="row static dim">Current group</div>`;
  for (const member of members) {
    html += `<div class="row static${member.online ? '' : ' dim'}"><span>${esc(member.name)}${member.isSelf ? ' (you)' : ''}</span>` +
      `<span>${member.online ? (member.downed ? 'down' : esc(member.spaceId)) : 'offline'}</span></div>`;
  }
  html += `<div class="row static dim">Nearby players</div>`;
  if (nearby.length === 0) html += `<div class="row static dim">No ungrouped players nearby.</div>`;
  for (const actor of nearby) {
    html += `<button type="button" class="row" data-act="party-invite" data-target="${actor.id}"><span>${esc(actor.name)}</span><span>Invite</span></button>`;
  }
  if (partyId) html += `<button type="button" class="row" data-act="party-leave"><span>Leave party</span></button>`;
  html += `<div class="hint"><kbd>O</kbd> close · invitations require a nearby player</div></div>`;
  return html;
}

export function renderControlsHelp(expanded: boolean): string {
  if (!expanded) {
    return `<div class="help-toggle" aria-label="Press H to show game controls"><kbd>H</kbd> Controls</div>`;
  }
  return `<aside class="help-card" aria-label="Game controls">
    <div class="help-head"><strong>Controls</strong><span><kbd>H</kbd> hide</span></div>
    <p class="look-hint">Click the world to capture the mouse and look around.</p>
    <div class="control-grid">
      <section class="control-group"><h3>Movement</h3>
        <div class="control-row"><kbd>WASD</kbd><span>Move</span></div>
        <div class="control-row"><kbd>Shift</kbd><span>Sprint</span></div>
        <div class="control-row"><kbd>C / Space</kbd><span>Sneak / jump</span></div>
      </section>
      <section class="control-group"><h3>Combat</h3>
        <div class="control-row"><kbd>LMB</kbd><span>Attack</span></div>
        <div class="control-row"><kbd>RMB</kbd><span>Block</span></div>
        <div class="control-row"><kbd>1 / 2</kbd><span>Aim / cast spells</span></div>
        <div class="control-row"><kbd>3 / 4 / 5</kbd><span>Use consumables</span></div>
      </section>
      <section class="control-group"><h3>World</h3>
        <div class="control-row"><kbd>E</kbd><span>Interact</span></div>
        <div class="control-row"><kbd>Tab</kbd><span>Inventory</span></div>
        <div class="control-row"><kbd>M</kbd><span>Map / destination</span></div>
        <div class="control-row"><kbd>J / P / O</kbd><span>Journal / perks / party</span></div>
      </section>
      <section class="control-group"><h3>Utility</h3>
        <div class="control-row"><kbd>W/S + Enter</kbd><span>Navigate / accept menus</span></div>
        <div class="control-row"><kbd>Enter</kbd><span>Nearby chat in the world</span></div>
        <div class="control-row"><kbd>V</kbd><span>Camera</span></div>
        <div class="control-row"><kbd>F5 / F9</kbd><span>Save / load</span></div>
        <div class="control-row"><kbd>Esc</kbd><span>Settings / close</span></div>
      </section>
    </div>
  </aside>`;
}
