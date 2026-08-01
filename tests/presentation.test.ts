import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS,
  effectiveBusGain,
  parseAudioSettings,
  soundscapeFor,
} from '../src/game/combat_audio';
import { TransformHistory, interpolateYaw } from '../src/render/interpolation';
import { renderAudioSettings } from '../src/ui/hud';
import { equippedAttackKind } from '../src/game/host_actions';
import { capturesEditableTargetKey } from '../src/game/input';

describe('host-side transform interpolation', () => {
  it('blends position and takes the shortest yaw arc between observed ticks', () => {
    const history = new TransformHistory();
    const from = { spaceId: 'kaldwyn', x: 0, y: 2, z: 4, yaw: Math.PI * 0.99 };
    const to = { spaceId: 'kaldwyn', x: 2, y: 2.4, z: 5, yaw: -Math.PI * 0.99 };

    expect(history.sample(1, from, 0.5)).toEqual(from);
    const sample = history.sample(1, to, 0.5);
    expect(sample.x).toBeCloseTo(1);
    expect(sample.y).toBeCloseTo(2.2);
    expect(sample.z).toBeCloseTo(4.5);
    expect(Math.abs(Math.abs(sample.yaw) - Math.PI)).toBeLessThan(0.04);
    expect(interpolateYaw(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
  });

  it('snaps on space transitions, large teleports, and first observation', () => {
    const history = new TransformHistory(3);
    const start = { spaceId: 'kaldwyn', x: 0, y: 0, z: 0, yaw: 0 };
    const door = { spaceId: 'siltroot_burrow', x: 0, y: 0, z: 2, yaw: Math.PI };
    const teleport = { spaceId: 'siltroot_burrow', x: 30, y: 0, z: 30, yaw: 0 };

    expect(history.sample(7, start, 0)).toEqual(start);
    expect(history.sample(7, door, 0.25)).toEqual(door);
    expect(history.sample(7, teleport, 0.25)).toEqual(teleport);
  });
});

describe('browser audio presentation contract', () => {
  it('loads bounded settings and falls back safely from malformed storage', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('{bad json')).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings(JSON.stringify({
      master: 2,
      effects: -1,
      ambience: 0.25,
      music: 0.75,
      muted: true,
    }))).toEqual({ master: 1, effects: 0, ambience: 0.25, music: 0.75, muted: true });
  });

  it('routes every bus through master mute and chooses a deterministic soundscape', () => {
    expect(effectiveBusGain({ ...DEFAULT_AUDIO_SETTINGS, master: 0.5, effects: 0.4 }, 'effects')).toBeCloseTo(0.2);
    expect(effectiveBusGain({ ...DEFAULT_AUDIO_SETTINGS, muted: true }, 'music')).toBe(0);
    expect(soundscapeFor('interior', 12)).toMatchObject({ id: 'interior', ambienceHz: 54 });
    expect(soundscapeFor('exterior', 23).id).toBe('exterior-night');
    expect(soundscapeFor('exterior', 12).id).toBe('exterior-day');
  });

  it('renders accessible persistent controls for all buses', () => {
    const html = renderAudioSettings(DEFAULT_AUDIO_SETTINGS, 'locked');
    expect(html).toContain('aria-label="Audio settings"');
    for (const bus of ['master', 'effects', 'ambience', 'music']) {
      expect(html).toContain(`data-audio="${bus}"`);
      expect(html).toContain(`aria-label="${bus[0].toUpperCase()}${bus.slice(1)} volume"`);
    }
    expect(html).toContain('data-audio-mute');
    expect(html).toContain('data-audio-state');
    expect(html).toContain('Audio unlocks after keyboard or pointer input');
    expect(renderAudioSettings(DEFAULT_AUDIO_SETTINGS, 'running')).toContain('Audio active.');
  });
});

describe('browser host equipment dispatch', () => {
  it('uses the authored weapon type for every equipped bow rather than one item id', () => {
    expect(equippedAttackKind([{ itemId: 'hunting_bow', kind: 'weapon', equipped: true }])).toBe('ranged');
    expect(equippedAttackKind([{ itemId: 'ironbound_bow', kind: 'weapon', equipped: true }])).toBe('ranged');
    expect(equippedAttackKind([{ itemId: 'iron_sword', kind: 'weapon', equipped: true }])).toBe('melee');
  });
});

describe('presentation input capture', () => {
  it('keeps Escape available while an audio control has focus', () => {
    expect(capturesEditableTargetKey('Escape')).toBe(true);
    expect(capturesEditableTargetKey('KeyW')).toBe(false);
  });
});
