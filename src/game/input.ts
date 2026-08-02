// Keyboard/mouse input -> per-tick PlayerInput + one-shot commands.
// Keybinds: WASD move, mouse look (pointer lock), Shift sprint, C sneak,
// Space jump, RMB block, LMB attack (weapon-appropriate), 1/2 aimed spells,
// 3/4/5 consumables,
// E interact, Tab inventory, M map, J journal, P perks, O party, Enter chat,
// H controls, V camera toggle,
// F5/F9 save/load.

import { clampAimPitch } from '../sim/player/aim';

export interface FrameCommands {
  melee: boolean;
  ranged: boolean;
  spell1: boolean;
  spell2: boolean;
  consumable1: boolean;
  consumable2: boolean;
  consumable3: boolean;
  lootAll: boolean;
  interact: boolean;
  toggleInventory: boolean;
  toggleMap: boolean;
  toggleJournal: boolean;
  togglePerks: boolean;
  toggleSocial: boolean;
  toggleChat: boolean;
  toggleHelp: boolean;
  toggleCamera: boolean;
  uiPrevious: boolean;
  uiNext: boolean;
  uiAccept: boolean;
  save: boolean;
  load: boolean;
  escape: boolean;
}

export class Input {
  private keys = new Set<string>();
  private commands: FrameCommands = emptyCommands();
  yaw = 0;
  pitch = -0.25;
  attackHeld = false;
  blockHeld = false;
  wheelDelta = 0;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      const editableTarget = e.target instanceof HTMLTextAreaElement
        || (e.target instanceof HTMLInputElement && isTextEntryInput(e.target));
      if (editableTarget && !capturesEditableTargetKey(e.code)) return;
      const navigationRepeat = uiNavigationDeltaForKey(e.code) !== 0;
      if (e.repeat && !navigationRepeat) return;
      if (!e.repeat) this.keys.add(e.code);
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.commands.uiPrevious = true;
          if (e.code === 'ArrowUp') e.preventDefault();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.commands.uiNext = true;
          if (e.code === 'ArrowDown') e.preventDefault();
          break;
        case 'KeyE':
          this.commands.interact = true;
          break;
        case 'Tab':
          this.commands.toggleInventory = true;
          e.preventDefault();
          break;
        case 'KeyM':
          this.commands.toggleMap = true;
          break;
        case 'KeyJ':
          this.commands.toggleJournal = true;
          break;
        case 'KeyP':
          this.commands.togglePerks = true;
          break;
        case 'KeyO':
          this.commands.toggleSocial = true;
          break;
        case 'Enter':
          this.commands.toggleChat = true;
          this.commands.uiAccept = true;
          e.preventDefault();
          break;
        case 'KeyH':
          this.commands.toggleHelp = true;
          break;
        case 'KeyV':
          this.commands.toggleCamera = true;
          break;
        case 'Digit1':
          this.commands.spell1 = true;
          break;
        case 'Digit2':
          this.commands.spell2 = true;
          break;
        case 'Digit3':
          this.commands.consumable1 = true;
          break;
        case 'Digit4':
          this.commands.consumable2 = true;
          break;
        case 'Digit5':
          this.commands.consumable3 = true;
          break;
        case 'KeyR':
          this.commands.lootAll = true;
          break;
        case 'F5':
          this.commands.save = true;
          e.preventDefault();
          break;
        case 'F9':
          this.commands.load = true;
          e.preventDefault();
          break;
        case 'Escape':
          this.commands.escape = true;
          break;
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) {
        // Embedded/automation browsers may deny pointer lock. That should
        // leave mouse-look inactive without surfacing an unhandled rejection.
        try {
          void canvas.requestPointerLock().catch(() => undefined);
        } catch {
          // Older engines may throw synchronously instead of returning a
          // rejected promise; the next real user click can retry safely.
        }
        return;
      }
      if (e.button === 0) {
        this.commands.melee = true;
        this.attackHeld = true;
      }
      if (e.button === 2) this.blockHeld = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attackHeld = false;
      if (e.button === 2) this.blockHeld = false;
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0026;
      this.pitch = clampAimPitch(this.pitch - e.movementY * 0.0026);
    });
    addEventListener('wheel', (e) => {
      this.wheelDelta += e.deltaY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Movement axes in player-local space. */
  moveAxes(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    return { x, z };
  }

  sprint(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  sneak(): boolean {
    return this.keys.has('KeyC');
  }

  jump(): boolean {
    return this.keys.has('Space');
  }

  /** Interactive surfaces consume movement keys. Clearing their held state
   * prevents a navigation press from moving the player as the surface closes. */
  releaseGameplayKeys(): void {
    for (const code of [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ShiftLeft', 'ShiftRight', 'KeyC', 'Space',
    ]) this.keys.delete(code);
    this.attackHeld = false;
    this.blockHeld = false;
  }

  /** One-shot commands accumulated since the last drain. */
  drainCommands(): FrameCommands {
    const out = this.commands;
    this.commands = emptyCommands();
    return out;
  }

  drainWheel(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }
}

export function capturesEditableTargetKey(code: string): boolean {
  return code === 'Escape';
}

function isTextEntryInput(input: HTMLInputElement): boolean {
  return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'].includes(input.type);
}

export function uiNavigationDeltaForKey(code: string): -1 | 0 | 1 {
  if (code === 'KeyW' || code === 'ArrowUp') return -1;
  if (code === 'KeyS' || code === 'ArrowDown') return 1;
  return 0;
}

function emptyCommands(): FrameCommands {
  return {
    melee: false,
    ranged: false,
    spell1: false,
    spell2: false,
    consumable1: false,
    consumable2: false,
    consumable3: false,
    lootAll: false,
    interact: false,
    toggleInventory: false,
    toggleMap: false,
    toggleJournal: false,
    togglePerks: false,
    toggleSocial: false,
    toggleChat: false,
    toggleHelp: false,
    toggleCamera: false,
    uiPrevious: false,
    uiNext: false,
    uiAccept: false,
    save: false,
    load: false,
    escape: false,
  };
}
