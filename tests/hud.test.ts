import { describe, expect, it } from 'vitest';
import {
  renderControlsHelp,
  renderResourceMeter,
  renderResourceMeters,
  resourcePercent,
} from '../src/ui/hud';

describe('HUD resource readability', () => {
  it('renders named, numeric, accessible meters for all three resources', () => {
    const html = renderResourceMeters({
      health: 73,
      maxHealth: 100,
      stamina: 48,
      maxStamina: 120,
      magicka: 31,
      maxMagicka: 80,
    });

    for (const [label, current, maximum] of [
      ['Health', 73, 100],
      ['Stamina', 48, 120],
      ['Magicka', 31, 80],
    ] as const) {
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`aria-valuenow="${current}"`);
      expect(html).toContain(`aria-valuemax="${maximum}"`);
      expect(html).toContain(`<span class="resource-label">${label}</span>`);
      expect(html).toContain(`${current} / ${maximum}`);
    }
    expect(html.match(/role="meter"/g)).toHaveLength(3);
  });

  it('clamps damaged or invalid resource widths instead of emitting broken CSS', () => {
    expect(resourcePercent(-20, 100)).toBe(0);
    expect(resourcePercent(140, 100)).toBe(100);
    expect(resourcePercent(50, 0)).toBe(0);
    expect(resourcePercent(Number.NaN, 100)).toBe(0);

    const html = renderResourceMeter('health', Number.NaN, 0);
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain('aria-valuemax="1"');
    expect(html).toContain('width:0.00%');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});

describe('HUD controls onboarding', () => {
  it('shows a structured, complete control reference when expanded', () => {
    const html = renderControlsHelp(true);
    expect(html).toContain('aria-label="Game controls"');
    expect(html).toContain('Click the world to capture the mouse');
    for (const control of ['WASD', 'LMB', 'RMB', '1 / 2', 'Tab', 'J / P', 'F5 / F9', 'Esc']) {
      expect(html).toContain(`<kbd>${control}</kbd>`);
    }
    expect(html).toContain('<kbd>H</kbd> hide');
  });

  it('collapses to a readable reminder that explains how to restore it', () => {
    const html = renderControlsHelp(false);
    expect(html).toContain('aria-label="Press H to show game controls"');
    expect(html).toContain('<kbd>H</kbd> Controls');
    expect(html).not.toContain('control-grid');
  });
});
