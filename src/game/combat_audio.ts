// Minimal host-side combat audio. Cues derive only from authoritative events;
// this module cannot submit intent or influence simulation outcomes. The
// synthesized palette keeps the first feedback layer asset-free and testable.

import type { SimEvent } from '../sim/types';

export type CombatCue = 'hit' | 'block' | 'hurt' | 'danger' | 'interrupt' | 'down' | 'revive';

export function combatCues(events: readonly SimEvent[], selfId: number): CombatCue[] {
  const cues: CombatCue[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'damage':
        if (event.targetId === selfId) cues.push(event.blocked ? 'block' : 'hurt');
        else if (event.sourceId === selfId) cues.push(event.blocked ? 'block' : 'hit');
        break;
      case 'telegraph':
        cues.push('danger');
        break;
      case 'interrupted':
        cues.push('interrupt');
        break;
      case 'playerDowned':
        if (event.playerId === selfId) cues.push('down');
        break;
      case 'playerRevived':
      case 'playerReleased':
        if (event.playerId === selfId) cues.push('revive');
        break;
      default:
        break;
    }
  }
  return cues;
}

export class CombatAudio {
  private context: AudioContext | null = null;
  private lastPlayed = new Map<CombatCue, number>();

  constructor(activationTarget: HTMLElement) {
    const unlock = () => this.unlock();
    activationTarget.addEventListener('pointerdown', unlock, { passive: true });
    addEventListener('keydown', unlock, { passive: true });
  }

  handle(events: readonly SimEvent[], selfId: number): void {
    for (const cue of combatCues(events, selfId)) this.play(cue);
  }

  state(): AudioContextState | 'locked' {
    return this.context?.state ?? 'locked';
  }

  private unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  private play(cue: CombatCue): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    const cooldown = cue === 'hurt' ? 0.18 : cue === 'danger' ? 0.45 : 0.07;
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < cooldown) return;
    this.lastPlayed.set(cue, now);

    switch (cue) {
      case 'hit':
        this.tone(620, 900, 0.055, 0.075, 'square');
        break;
      case 'block':
        this.tone(980, 540, 0.06, 0.09, 'triangle');
        this.tone(1320, 760, 0.035, 0.06, 'triangle', 0.035);
        break;
      case 'hurt':
        this.tone(145, 75, 0.075, 0.16, 'sawtooth');
        break;
      case 'danger':
        this.tone(260, 520, 0.045, 0.22, 'sine');
        break;
      case 'interrupt':
        this.tone(820, 1240, 0.05, 0.14, 'triangle');
        break;
      case 'down':
        this.tone(180, 55, 0.08, 0.45, 'sawtooth');
        break;
      case 'revive':
        this.tone(390, 780, 0.05, 0.28, 'sine');
        break;
    }
  }

  private tone(
    startHz: number,
    endHz: number,
    volume: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
  ): void {
    const context = this.context;
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
}
