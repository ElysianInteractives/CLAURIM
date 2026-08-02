import { describe, expect, it } from 'vitest';
import {
  boundedUiSelectionIndex,
  renderControlsHelp,
  renderChatComposer,
  renderSocialPanel,
  renderCombatTarget,
  renderResourceMeter,
  renderResourceMeters,
  renderDialoguePanel,
  resourcePercent,
  selectCombatTarget,
} from '../src/ui/hud';
import type { ActorView, PartyMemberView } from '../src/world_api';

function actor(overrides: Partial<ActorView> = {}): ActorView {
  return {
    id: 1,
    templateId: 'player',
    archetype: 'player',
    name: 'Alva',
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    aimPitch: 0,
    dead: false,
    downed: false,
    health: 100,
    maxHealth: 100,
    sneaking: false,
    blocking: false,
    attacking: false,
    attackKind: null,
    attackPhase: null,
    telegraphTicks: 0,
    equipment: {},
    isPlayer: true,
    isRemotePlayer: false,
    hostileToPlayer: false,
    hasDialogue: false,
    tier: 'standard',
    ...overrides,
  };
}

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
    for (const control of ['WASD', 'LMB', 'RMB', '1 / 2', 'Tab', 'J / P / O', 'Enter', 'F5 / F9', 'Esc']) {
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

describe('HUD keyboard interaction', () => {
  it('renders dialogue choices as stable semantic actions with keyboard guidance', () => {
    const html = renderDialoguePanel({
      speakerName: 'Corren Pike',
      text: 'The ridge road has become dangerous.',
      choices: ['What happened?', 'Farewell.'],
    });
    expect(html).toContain('role="dialog"');
    expect(html.match(/<button type="button" class="row" data-act="dlg"/g)).toHaveLength(2);
    expect(html).toContain('<kbd>W</kbd>/<kbd>S</kbd> select');
    expect(html).toContain('<kbd>Enter</kbd> choose');
  });

  it('keeps vertical selection within the available actions', () => {
    expect(boundedUiSelectionIndex(0, 3, -1)).toBe(0);
    expect(boundedUiSelectionIndex(0, 3, 1)).toBe(1);
    expect(boundedUiSelectionIndex(2, 3, 1)).toBe(2);
    expect(boundedUiSelectionIndex(0, 0, 1)).toBe(-1);
  });
});

describe('HUD social controls', () => {
  it('renders a bounded accessible chat composer without inserting raw markup', () => {
    const html = renderChatComposer('<hello>', 400);
    expect(html).toContain('aria-label="Chat message"');
    // HTML maxlength counts UTF-16 units. Four hundred permits 200 astral
    // code points; the input handler enforces the actual 200-code-point cap.
    expect(html).toContain('maxlength="400"');
    expect(html).toContain('type="submit">Send</button>');
    expect(html).toContain('value="&lt;hello&gt;"');
    expect(html).not.toContain('value="<hello>"');
  });

  it('renders invites, online state, nearby invite actions, and leave controls', () => {
    const members: PartyMemberView[] = [
      { charId: 'alva', entityId: 1, name: 'Alva', health: 80, maxHealth: 100, downed: false, spaceId: 'kaldwyn', isSelf: true, online: true },
      { charId: 'brona', entityId: null, name: 'Brona', health: 0, maxHealth: 1, downed: false, spaceId: 'kaldwyn', isSelf: false, online: false },
    ];
    const html = renderSocialPanel(
      'party:alva',
      members,
      [{ fromCharId: 'cadan', fromName: 'Cadan', fromEntityId: 42 }],
      [actor({ id: 9, name: 'Dara', isPlayer: true, isRemotePlayer: true })],
    );
    expect(html).toContain('Cadan invited you');
    expect(html).toContain('data-act="party-accept"');
    expect(html).toContain('Brona');
    expect(html).toContain('offline');
    expect(html).toContain('data-act="party-invite" data-target="9"');
    expect(html).toContain('data-act="party-leave"');
  });
});

describe('HUD combat readability', () => {
  it('selects the hostile closest to the authoritative facing line', () => {
    const player = actor();
    const centered = actor({ id: 2, name: 'Centered Wolf', x: 0.4, z: 12, hostileToPlayer: true, isPlayer: false });
    const nearEdge = actor({ id: 3, name: 'Edge Wolf', x: 1.3, z: 4, hostileToPlayer: true, isPlayer: false });
    const friendly = actor({ id: 4, name: 'Friendly', z: 2, hostileToPlayer: false, isPlayer: false });
    const behind = actor({ id: 5, name: 'Behind', z: -2, hostileToPlayer: true, isPlayer: false });

    expect(selectCombatTarget(player, [nearEdge, friendly, behind, centered])?.id).toBe(centered.id);
  });

  it('selects against the vertical reticle ray instead of a flat facing cone', () => {
    const player = actor({ aimPitch: 0.45 });
    const raised = actor({ id: 2, y: 5.03, z: 10, hostileToPlayer: true, isPlayer: false });
    const ground = actor({ id: 3, y: 0, z: 10, hostileToPlayer: true, isPlayer: false });

    expect(selectCombatTarget(player, [ground, raised])?.id).toBe(raised.id);
  });

  it('renders an authoritative named and numeric target health meter', () => {
    const target = actor({
      id: 2,
      name: 'Pale Warden',
      health: 137,
      maxHealth: 380,
      tier: 'boss',
      hostileToPlayer: true,
      isPlayer: false,
    });
    const html = renderCombatTarget(target);

    expect(html).toContain('aria-label="Combat target"');
    expect(html).toContain('Pale Warden');
    expect(html).toContain('boss');
    expect(html).toContain('aria-valuenow="137"');
    expect(html).toContain('aria-valuemax="380"');
    expect(html).toContain('width:36.05%');
  });
});
