// Headless host: runs the same Sim without a renderer, at unbounded speed.
// Used for scripted playthroughs, balancing sweeps, and CI smoke runs.
// Usage: npm run headless [-- ticks=9000 seed=42]

import { Sim, type PlayerInput } from '../sim/sim';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split('=');
    return [k, v];
  }),
);

const ticks = Number(args.ticks ?? 3000);
const seed = Number(args.seed ?? 42);

const idle: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, sneak: false, block: false, jump: false };

const t0 = Date.now();
const sim = new Sim(seed);
for (let t = 0; t < ticks; t++) {
  sim.tick({ ...idle, moveZ: t % 90 < 45 ? 1 : 0, yaw: (t * 0.005) % (Math.PI * 2) });
}
const elapsed = Date.now() - t0;

const p = sim.player();
const alive = [...sim.actors.values()].filter((a) => !a.dead).length;
console.log(
  JSON.stringify(
    {
      seed,
      ticks,
      wallMs: elapsed,
      ticksPerSec: Math.round((ticks / Math.max(1, elapsed)) * 1000),
      gameHours: sim.gameHours().toFixed(2),
      player: { space: p.pos.spaceId, x: p.pos.x.toFixed(1), z: p.pos.z.toFixed(1), hp: p.health.toFixed(1), level: p.level },
      actorsAlive: alive,
      saveBytes: sim.saveToJson().length,
    },
    null,
    2,
  ),
);
