// Browser-owned audio director. Combat cues derive only from authoritative
// events, while ambience/music derive from read-only presentation state. This
// module cannot submit intent or influence simulation outcomes.

import type { SimEvent } from '../sim/types';

export type CombatCue = 'hit' | 'block' | 'hurt' | 'danger' | 'interrupt' | 'down' | 'revive';
export type AudioBus = 'effects' | 'ambience' | 'music';

export interface AudioSettings {
  master: number;
  effects: number;
  ambience: number;
  music: number;
  muted: boolean;
}

export interface Soundscape {
  id: 'interior' | 'exterior-day' | 'exterior-night';
  ambienceHz: number;
  musicHz: number;
  ambienceLevel: number;
  musicLevel: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.8,
  effects: 0.85,
  ambience: 0.45,
  music: 0.35,
  muted: false,
};

function boundedVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function normalizeAudioSettings(value: Partial<AudioSettings> | null | undefined): AudioSettings {
  return {
    master: boundedVolume(value?.master, DEFAULT_AUDIO_SETTINGS.master),
    effects: boundedVolume(value?.effects, DEFAULT_AUDIO_SETTINGS.effects),
    ambience: boundedVolume(value?.ambience, DEFAULT_AUDIO_SETTINGS.ambience),
    music: boundedVolume(value?.music, DEFAULT_AUDIO_SETTINGS.music),
    muted: typeof value?.muted === 'boolean' ? value.muted : DEFAULT_AUDIO_SETTINGS.muted,
  };
}

export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_AUDIO_SETTINGS };
    return normalizeAudioSettings(value as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function effectiveBusGain(settings: AudioSettings, bus: AudioBus): number {
  return settings.muted ? 0 : settings.master * settings[bus];
}

export function soundscapeFor(spaceKind: 'exterior' | 'interior', gameHours: number): Soundscape {
  if (spaceKind === 'interior') {
    return { id: 'interior', ambienceHz: 54, musicHz: 82.41, ambienceLevel: 0.075, musicLevel: 0.012 };
  }
  const hour = ((gameHours % 24) + 24) % 24;
  if (hour >= 20 || hour < 6) {
    return { id: 'exterior-night', ambienceHz: 92, musicHz: 110, ambienceLevel: 0.045, musicLevel: 0.018 };
  }
  return { id: 'exterior-day', ambienceHz: 138, musicHz: 146.83, ambienceLevel: 0.035, musicLevel: 0.014 };
}

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
  private settingsValue: AudioSettings;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceSceneGain: GainNode | null = null;
  private musicSceneGain: GainNode | null = null;
  private ambienceOscillator: OscillatorNode | null = null;
  private musicOscillator: OscillatorNode | null = null;
  private requestedSoundscape = soundscapeFor('exterior', 8);

  constructor(
    activationTarget: HTMLElement,
    settings: AudioSettings = DEFAULT_AUDIO_SETTINGS,
    private readonly onSettingsChanged?: (settings: AudioSettings) => void,
  ) {
    this.settingsValue = normalizeAudioSettings(settings);
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

  settings(): AudioSettings {
    return { ...this.settingsValue };
  }

  setSettings(settings: Partial<AudioSettings>): void {
    this.settingsValue = normalizeAudioSettings({ ...this.settingsValue, ...settings });
    this.applyMixerSettings();
    this.onSettingsChanged?.(this.settings());
  }

  update(spaceKind: 'exterior' | 'interior', gameHours: number): void {
    const next = soundscapeFor(spaceKind, gameHours);
    if (next.id === this.requestedSoundscape.id) return;
    this.requestedSoundscape = next;
    this.applySoundscape();
  }

  private unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.buildMixer();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  private buildMixer(): void {
    const context = this.context;
    if (!context) return;
    this.masterGain = context.createGain();
    this.effectsGain = context.createGain();
    this.ambienceGain = context.createGain();
    this.musicGain = context.createGain();
    this.effectsGain.connect(this.masterGain);
    this.ambienceGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);

    this.ambienceSceneGain = context.createGain();
    this.musicSceneGain = context.createGain();
    this.ambienceOscillator = context.createOscillator();
    this.musicOscillator = context.createOscillator();
    this.ambienceOscillator.type = 'sine';
    this.musicOscillator.type = 'triangle';
    this.ambienceOscillator.connect(this.ambienceSceneGain);
    this.musicOscillator.connect(this.musicSceneGain);
    this.ambienceSceneGain.connect(this.ambienceGain);
    this.musicSceneGain.connect(this.musicGain);
    this.ambienceOscillator.start();
    this.musicOscillator.start();
    this.applyMixerSettings();
    this.applySoundscape();
  }

  private applyMixerSettings(): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    this.masterGain?.gain.setTargetAtTime(this.settingsValue.muted ? 0 : this.settingsValue.master, now, 0.025);
    this.effectsGain?.gain.setTargetAtTime(this.settingsValue.effects, now, 0.025);
    this.ambienceGain?.gain.setTargetAtTime(this.settingsValue.ambience, now, 0.1);
    this.musicGain?.gain.setTargetAtTime(this.settingsValue.music, now, 0.1);
  }

  private applySoundscape(): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    this.ambienceOscillator?.frequency.setTargetAtTime(this.requestedSoundscape.ambienceHz, now, 0.4);
    this.musicOscillator?.frequency.setTargetAtTime(this.requestedSoundscape.musicHz, now, 0.8);
    this.ambienceSceneGain?.gain.setTargetAtTime(this.requestedSoundscape.ambienceLevel, now, 0.6);
    this.musicSceneGain?.gain.setTargetAtTime(this.requestedSoundscape.musicLevel, now, 1.2);
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
    gain.connect(this.effectsGain ?? context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
}
