// Fixed-seed Plan 5 network-condition matrix. It runs real ClientWorld and
// ServerCore instances through ordered delayed/lossy message links without
// wall-clock sleeps, reporting authority latency, correction, throughput, and
// remote-player motion. Run: npm run net:bench

import { ClientWorld } from '../net/client_world';
import {
  ImpairmentPolicy,
  NETWORK_PROFILES,
  type NetworkProfile,
} from '../net/impairment';
import { parseClientMessage, type ServerMessage } from '../net/protocol';
import { ServerCore } from '../server/core';
import { MemoryStorage } from '../server/storage';
import { DT } from '../sim/types';

interface ScheduledDelivery {
  atMs: number;
  order: number;
  deliver: () => void;
}

class VirtualNetwork {
  nowMs = 0;
  private order = 0;
  private deliveries: ScheduledDelivery[] = [];

  send(policy: ImpairmentPolicy, droppable: boolean, deliver: () => void): boolean {
    const plan = policy.plan(this.nowMs, droppable);
    if (plan.dropped) return false;
    this.deliveries.push({ atMs: plan.deliveryAtMs, order: this.order++, deliver });
    return true;
  }

  advanceTo(targetMs: number): void {
    while (true) {
      this.deliveries.sort((a, b) => a.atMs - b.atMs || a.order - b.order);
      const next = this.deliveries[0];
      if (!next || next.atMs > targetMs) break;
      this.deliveries.shift();
      this.nowMs = next.atMs;
      next.deliver();
    }
    this.nowMs = targetMs;
  }
}

interface HarnessClient {
  charId: string;
  connId: string;
  world: ClientWorld;
  c2s: ImpairmentPolicy;
  s2c: ImpairmentPolicy;
  lastObservedAck: number;
  ackLatencies: number[];
  deliveredSnapshotBytes: number;
  deliveredSnapshots: number;
  droppedInputs: number;
  droppedSnapshots: number;
}

export interface NetworkBenchResult {
  profile: NetworkProfile['name'];
  rttMs: number;
  jitterMs: number;
  lossPercent: number;
  qualityTarget: boolean;
  connected: boolean;
  disconnects: number;
  inputToAuthorityP95Ms: number;
  inputToAuthorityMaxMs: number;
  maxCorrectionMeters: number;
  snapshotBytesPerSecond: number;
  remoteMotionMeters: number;
  authoritativeMotionMeters: number;
  droppedInputs: number;
  droppedSnapshots: number;
  pendingInputsAtEnd: number;
}

export function runNetworkProfile(profile: NetworkProfile, seed = 5105): NetworkBenchResult {
  const network = new VirtualNetwork();
  const core = new ServerCore(new MemoryStorage(), 20260731);
  const clients: HarnessClient[] = [];

  const addClient = (charId: string, name: string, stream: number): HarnessClient => {
    const client: HarnessClient = {
      charId,
      connId: `virtual_${stream}`,
      world: new ClientWorld(charId, name, () => network.nowMs),
      c2s: new ImpairmentPolicy(profile, seed + stream * 101),
      s2c: new ImpairmentPolicy(profile, seed + stream * 101 + 1),
      lastObservedAck: -1,
      ackLatencies: [],
      deliveredSnapshotBytes: 0,
      deliveredSnapshots: 0,
      droppedInputs: 0,
      droppedSnapshots: 0,
    };
    clients.push(client);

    core.connect(client.connId, (message) => {
      const json = JSON.stringify(message);
      const droppable = message.t === 'snapshot';
      const accepted = network.send(client.s2c, droppable, () => {
        const delivered = client.world.onMessage(json);
        if (delivered?.t !== 'snapshot') return;
        client.deliveredSnapshots++;
        client.deliveredSnapshotBytes += new TextEncoder().encode(json).byteLength;
        const diagnostics = client.world.diagnostics();
        if (diagnostics.lastAckSeq > client.lastObservedAck) {
          client.lastObservedAck = diagnostics.lastAckSeq;
          if (diagnostics.lastAckLatencyMs > 0) client.ackLatencies.push(diagnostics.lastAckLatencyMs);
        }
      });
      if (!accepted && droppable) client.droppedSnapshots++;
    }, { accountId: `bench_${stream}`, characters: [{ charId, name }] });

    client.world.beginSession({
      send: (json) => {
        const message = parseClientMessage(json);
        const droppable = message?.t === 'input';
        const accepted = network.send(client.c2s, droppable, () => core.onMessage(client.connId, json));
        if (!accepted && droppable) client.droppedInputs++;
      },
    });
    return client;
  };

  const mover = addClient('net_alva', 'Net Alva', 1);
  const observer = addClient('net_brona', 'Net Brona', 2);
  const tickMs = DT * 1_000;
  const totalTicks = 420;
  const inputTicks = 300;
  const movementTicks = 150;
  let connected = false;
  let moverStart: { x: number; z: number } | null = null;
  let remoteStart: { x: number; z: number } | null = null;
  let remoteLast: { x: number; z: number } | null = null;

  for (let tick = 0; tick < totalTicks; tick++) {
    const tickStart = tick * tickMs;
    network.advanceTo(tickStart);
    connected ||= clients.every((client) => client.world.ready());
    if (mover.world.ready() && !moverStart) {
      const actor = core.sim.playerActor(mover.charId);
      if (actor) moverStart = { x: actor.pos.x, z: actor.pos.z };
    }

    if (tick < inputTicks) {
      if (mover.world.ready()) {
        mover.world.step({
          moveX: 0,
          moveZ: tick < movementTicks ? 1 : 0,
          yaw: 0,
          sprint: false,
          sneak: false,
          block: false,
          jump: false,
        });
      }
      if (observer.world.ready()) {
        observer.world.step({
          moveX: 0,
          moveZ: 0,
          yaw: 0,
          sprint: false,
          sneak: false,
          block: false,
          jump: false,
        });
      }
    }

    core.tick();
    network.advanceTo((tick + 1) * tickMs);

    const remote = observer.world
      .actorsInSpace()
      .find((actor) => actor.isRemotePlayer && actor.name === 'Net Alva');
    if (remote) {
      remoteStart ??= { x: remote.x, z: remote.z };
      remoteLast = { x: remote.x, z: remote.z };
    }
  }

  const moverEnd = core.sim.playerActor(mover.charId)?.pos;
  const diagnostics = mover.world.diagnostics();
  const measuredSeconds = (totalTicks * tickMs) / 1_000;
  return {
    profile: profile.name,
    rttMs: profile.rttMs,
    jitterMs: profile.jitterMs,
    lossPercent: profile.loss * 100,
    qualityTarget: profile.qualityTarget,
    connected,
    disconnects: 0,
    inputToAuthorityP95Ms: percentile(mover.ackLatencies, 0.95),
    inputToAuthorityMaxMs: mover.ackLatencies.length > 0 ? Math.max(...mover.ackLatencies) : 0,
    maxCorrectionMeters: diagnostics.maxCorrectionMeters,
    snapshotBytesPerSecond: mover.deliveredSnapshotBytes / measuredSeconds,
    remoteMotionMeters:
      remoteStart && remoteLast
        ? Math.hypot(remoteLast.x - remoteStart.x, remoteLast.z - remoteStart.z)
        : 0,
    authoritativeMotionMeters:
      moverStart && moverEnd
        ? Math.hypot(moverEnd.x - moverStart.x, moverEnd.z - moverStart.z)
        : 0,
    droppedInputs: mover.droppedInputs,
    droppedSnapshots: mover.droppedSnapshots,
    pendingInputsAtEnd: diagnostics.pendingInputs,
  };
}

export function runNetworkMatrix(): NetworkBenchResult[] {
  return NETWORK_PROFILES.map((profile, index) => runNetworkProfile(profile, 5105 + index * 1000));
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/network_bench.ts')) {
  console.log(JSON.stringify(runNetworkMatrix(), null, 2));
}
