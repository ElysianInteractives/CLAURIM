// The renderer coordinator: observes IWorld, owns the scene graph, streams
// terrain cells, swaps space contents on transitions, poses characters, and
// drives time-of-day lighting. It reads the world and submits NOTHING:
// gameplay outcomes never originate here (LOCKED D-001).

import * as THREE from 'three';
import type { ActorView, IWorld } from '../world_api';
import { CONTENT } from '../sim/content';
import { PALETTE } from './palette';
import { TerrainStreamer, disposeGroup } from './terrain_mesh';
import { buildContainerMesh, buildDoorMarker, buildInteriorShell, buildProp } from './structures';
import { buildCharacter, poseCharacter } from './characters';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private webgl: THREE.WebGLRenderer;
  private terrain: TerrainStreamer;
  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private hemi = new THREE.HemisphereLight(0xbfd4e0, 0x5a5244, 1.1);
  private spaceGroup = new THREE.Group();
  private actorMeshes = new Map<number, THREE.Group>();
  private projectileMeshes = new Map<number, THREE.Mesh>();
  private aoeMeshes = new Map<number, THREE.Mesh>();
  private telegraphRings = new Map<number, THREE.Mesh>();
  private builtSpace: string | null = null;
  private clock = 0;

  /** Third/first person camera rig. */
  cameraYaw = 0;
  cameraPitch = -0.25;
  cameraDistance = 6;
  firstPerson = false;

  constructor(
    private world: IWorld,
    canvas: HTMLCanvasElement,
  ) {
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
    this.scene.add(this.sun, this.hemi, this.spaceGroup);
    this.sun.position.set(120, 180, 60);
    this.terrain = new TerrainStreamer(this.scene, world.seed());
    this.resize();
  }

  resize(): void {
    const w = this.webgl.domElement.clientWidth || innerWidth;
    const h = this.webgl.domElement.clientHeight || innerHeight;
    this.webgl.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    void w;
    void h;
  }

  /** Full render pass for the current frame. */
  render(dtSec: number): void {
    this.clock += dtSec;
    const space = this.world.currentSpace();
    const exterior = this.world.spaceKind(space) === 'exterior';
    const player = this.world.player();

    if (this.builtSpace !== space) this.rebuildSpace(space, exterior);
    if (exterior) this.terrain.update(player.x, player.z, 2);
    this.updateLighting(exterior);
    this.updateActors();
    this.updateProjectiles();
    this.updateGroundAoes();
    this.updateCamera(player);
    this.webgl.render(this.scene, this.camera);
  }

  private rebuildSpace(space: string, exterior: boolean): void {
    // Drop previous space contents + actor meshes.
    for (const child of [...this.spaceGroup.children]) {
      this.spaceGroup.remove(child);
      if (child instanceof THREE.Group) disposeGroup(child);
    }
    for (const [, mesh] of this.actorMeshes) {
      this.scene.remove(mesh);
      disposeGroup(mesh);
    }
    this.actorMeshes.clear();
    if (!exterior) this.terrain.clear();

    const seed = this.world.seed();
    const kind = exterior ? 'exterior' : 'interior';
    if (!exterior) {
      const layout = CONTENT.spaces[space]?.interior;
      if (layout) this.spaceGroup.add(buildInteriorShell(layout, space.includes('mine')));
    }
    for (const p of CONTENT.props) {
      if (p.spaceId === space) this.spaceGroup.add(buildProp(p, kind, seed));
    }
    for (const d of CONTENT.doors) {
      if (d.spaceId === space) this.spaceGroup.add(buildDoorMarker(d, kind, seed));
    }
    for (const c of CONTENT.containers) {
      if (c.spaceId === space) this.spaceGroup.add(buildContainerMesh(c, kind, seed));
    }
    this.builtSpace = space;
  }

  private updateLighting(exterior: boolean): void {
    if (!exterior) {
      this.scene.background = new THREE.Color(0x060606);
      this.scene.fog = new THREE.Fog(0x0a0a0a, 8, 60);
      this.sun.intensity = 0.15;
      this.hemi.intensity = 0.35;
      return;
    }
    const hour = this.world.gameHours() % 24;
    // Day factor: 0 at midnight, 1 at noon.
    const daylight = Math.max(0, Math.min(1, 1.15 - Math.abs(hour - 12) / 7.5));
    const dawnDusk = Math.max(0, 1 - Math.abs(hour - 6.5) / 1.6) + Math.max(0, 1 - Math.abs(hour - 19.5) / 1.6);
    const sky = new THREE.Color(PALETTE.skyNight).lerp(new THREE.Color(PALETTE.skyDay), daylight);
    sky.lerp(new THREE.Color(PALETTE.skyDawn), Math.min(0.55, dawnDusk));
    this.scene.background = sky;
    const fog = new THREE.Color(PALETTE.fogNight).lerp(new THREE.Color(PALETTE.fogDay), daylight);
    this.scene.fog = new THREE.Fog(fog.getHex(), 60, 480);
    this.sun.intensity = 0.25 + daylight * 2.2;
    this.sun.color.setHex(dawnDusk > 0.4 ? PALETTE.skyDawn : 0xffffff);
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(sunAngle) * 200, Math.max(20, Math.sin(sunAngle) * 220), 80);
    this.hemi.intensity = 0.35 + daylight * 0.9;
  }

  private updateActors(): void {
    const views = this.world.actorsInSpace();
    const seen = new Set<number>();
    for (const v of views) {
      seen.add(v.id);
      let mesh = this.actorMeshes.get(v.id);
      if (!mesh) {
        mesh = buildCharacter(v.archetype);
        this.actorMeshes.set(v.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(v.x, v.y, v.z);
      mesh.rotation.y = v.yaw;
      poseCharacter(mesh, v, this.clock);
      // Hide the player body in first person.
      mesh.visible = !(v.isPlayer && !v.isRemotePlayer && this.firstPerson);
      // Telegraph warning ring: pulses under a casting enemy (combat
      // readability for parties; observes state only).
      let ring = this.telegraphRings.get(v.id);
      if (v.telegraphTicks > 0 && !v.dead) {
        if (!ring) {
          ring = new THREE.Mesh(
            new THREE.RingGeometry(1.1, 1.7, 24),
            new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          this.telegraphRings.set(v.id, ring);
          this.scene.add(ring);
        }
        ring.position.set(v.x, v.y + 0.06, v.z);
        const pulse = 1 + 0.2 * Math.sin(this.clock * 10);
        ring.scale.setScalar(pulse * (v.tier === 'boss' ? 1.8 : 1));
      } else if (ring) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        this.telegraphRings.delete(v.id);
      }
    }
    for (const [id, mesh] of [...this.actorMeshes]) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        disposeGroup(mesh);
        this.actorMeshes.delete(id);
      }
    }
  }

  private updateProjectiles(): void {
    const views = this.world.projectilesInSpace();
    const seen = new Set<number>();
    for (const v of views) {
      seen.add(v.id);
      let mesh = this.projectileMeshes.get(v.id);
      if (!mesh) {
        const color = v.kind === 'arrow' ? PALETTE.arrow : v.channel === 'frost' ? PALETTE.frost : PALETTE.flame;
        mesh = new THREE.Mesh(
          v.kind === 'arrow' ? new THREE.BoxGeometry(0.06, 0.06, 0.6) : new THREE.SphereGeometry(0.16, 6, 5),
          new THREE.MeshBasicMaterial({ color }),
        );
        this.projectileMeshes.set(v.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(v.x, v.y, v.z);
    }
    for (const [id, mesh] of [...this.projectileMeshes]) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.projectileMeshes.delete(id);
      }
    }
  }

  private updateGroundAoes(): void {
    const views = this.world.groundAoesInSpace();
    const seen = new Set<number>();
    for (const v of views) {
      seen.add(v.id);
      let mesh = this.aoeMeshes.get(v.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1, 24),
          new THREE.MeshBasicMaterial({ color: PALETTE.frost, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
        );
        mesh.rotation.x = -Math.PI / 2;
        this.aoeMeshes.set(v.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(v.x, this.world.groundHeight(v.x, v.z) + 0.05, v.z);
      mesh.scale.setScalar(v.radius);
    }
    for (const [id, mesh] of [...this.aoeMeshes]) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.aoeMeshes.delete(id);
      }
    }
  }

  private updateCamera(player: ActorView): void {
    const eye = 1.62;
    if (this.firstPerson) {
      this.camera.position.set(player.x, player.y + eye, player.z);
      this.camera.rotation.set(this.cameraPitch, this.cameraYaw + Math.PI, 0, 'YXZ');
      return;
    }
    // Camera collision (third-person, D-023): march along the eye->camera ray
    // and shorten the boom where terrain/floor would occlude the player.
    let d = this.cameraDistance;
    const dirX = -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const dirZ = -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
    const dirY = -Math.sin(this.cameraPitch);
    const eyeY = player.y + eye;
    for (let s = 1; s <= 8; s++) {
      const t = (s / 8) * this.cameraDistance;
      const px = player.x + dirX * t;
      const pz = player.z + dirZ * t;
      const py = eyeY + dirY * t;
      if (py < this.world.groundHeight(px, pz) + 0.35) {
        d = Math.max(1.2, t - 0.6);
        break;
      }
    }
    const cx = player.x + dirX * d;
    const cz = player.z + dirZ * d;
    let cy = eyeY + dirY * d;
    const groundAtCam = this.world.groundHeight(cx, cz);
    if (cy < groundAtCam + 0.4) cy = groundAtCam + 0.4;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(player.x, player.y + eye, player.z);
  }
}
