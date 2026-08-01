// Player-requested stuck recovery policy. Destination selection and movement
// remain on Sim because they use its established recovery-point lifecycle.

import type { Actor } from '../types';
import type { SimContext } from '../sim_context';

export const PLAYER_RECOVERY_COOLDOWN_TICKS = 30 * 30;
export const PLAYER_RECOVERY_HOSTILE_RADIUS = 30;

export type PlayerRecoveryRejection = 'incapacitated' | 'combat' | 'cooldown';

export function recoveryRejection(
  ctx: SimContext,
  player: Actor,
  availableAtTick: number,
): PlayerRecoveryRejection | null {
  if (player.dead || player.downed) return 'incapacitated';
  if (ctx.tickCount() < availableAtTick) return 'cooldown';
  if (player.attack || player.blocking) return 'combat';

  for (const actor of ctx.actors.values()) {
    if (actor.id === player.id || actor.dead || actor.downed) continue;
    if (actor.pos.spaceId !== player.pos.spaceId || !ctx.isHostile(player, actor)) continue;
    if (Math.hypot(actor.pos.x - player.pos.x, actor.pos.z - player.pos.z) <= PLAYER_RECOVERY_HOSTILE_RADIUS) {
      return 'combat';
    }
  }
  return null;
}
