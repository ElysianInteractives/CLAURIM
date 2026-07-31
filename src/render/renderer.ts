// The renderer coordinator: observes IWorld, owns the scene graph, streams
// terrain cells, swaps space contents on transitions, poses characters, and
// drives time-of-day lighting. It reads the world and submits NOTHING:
// gameplay outcomes never originate here (LOCKED D-001).

import * as THREE from 'three';
import type { ActorView, IWorld } from '../world_api';
import { CONTENT } from '../sim/content';
import { CollisionIndex, worldObstructionT } from '../sim/world/collision';
import { PALETTE } from './palette';
import { TerrainStreamer, disposeGroup } from './terrain_mesh';
import { buildContainerMesh, buildDoorMarker, buildInteriorShell, buildProp } from './structures';
import { buildCharacter, poseCharacter } from './characters';

type TelegraphView = NonNullable<ActorView['telegraph']>;

function sectorGeometry(radius: number, angleDegrees: number): THREE.BufferGeometry {
  const half = (angleDegrees * Math.PI) / 360;
  const segments = 28;
  const vertices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = -half + (i / segments) * half * 2;
    const b = -half + ((i + 1) / segments) * half * 2;
    vertices.push(
      0, 0, 0,
      Math.sin(a) * radius, 0, Math.cos(a) * radius,
      Math.sin(b) * radius, 0, Math.cos(b) * radius,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildTelegraphMesh(view: TelegraphView): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  if (view.kind === 'frontal_cone') {
    geometry = sectorGeometry(view.range, view.angleDegrees);
  } else if (view.kind === 'ground_aoe') {
    geometry = new THREE.CircleGeometry(view.radius, 32);
    geometry.rotateX(-Math.PI / 2);
  } else {
    geometry = new THREE.RingGeometry(1.1, 1.7, 28);
    geometry.rotateX(-Math.PI / 2);
  }
  const material = new THREE.MeshBasicMaterial({
    color: view.interruptible ? 0xffb347 : 0xff4d32,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.signature = `${view.kind}:${view.range}:${view.angleDegrees}:${view.radius}:${view.interruptible}`;
  return mesh;
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material.dispose();
}

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
  private collision = new CollisionIndex(CONTENT);
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
      const previousHealth = mesh.userData.lastHealth as number | undefined;
      if (previousHealth !== undefined && v.health < previousHealth) {
        mesh.userData.hitFlashUntil = this.clock + 0.14;
      }
      mesh.userData.lastHealth = v.health;
      const hitFlash = (mesh.userData.hitFlashUntil as number | undefined) ?? 0;
      mesh.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        const materials = Array.isArray(part.material) ? part.material : [part.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshLambertMaterial) {
            material.emissive.setHex(hitFlash > this.clock ? 0x7a1711 : 0x000000);
          }
        }
      });
      // Hide the player body in first person.
      mesh.visible = !(v.isPlayer && !v.isRemotePlayer && this.firstPerson);
      // Telegraphs render the authoritative danger shape: cone, target pool,
      // or caster ring. The renderer still resolves no gameplay.
      let ring = this.telegraphRings.get(v.id);
      if (v.telegraph && !v.dead) {
        const signature = `${v.telegraph.kind}:${v.telegraph.range}:${v.telegraph.angleDegrees}:${v.telegraph.radius}:${v.telegraph.interruptible}`;
        if (ring && ring.userData.signature !== signature) {
          this.scene.remove(ring);
          disposeMesh(ring);
          this.telegraphRings.delete(v.id);
          ring = undefined;
        }
        if (!ring) {
          ring = buildTelegraphMesh(v.telegraph);
          this.telegraphRings.set(v.id, ring);
          this.scene.add(ring);
        }
        const targetPlaced = v.telegraph.kind === 'ground_aoe';
        const telegraphX = targetPlaced ? v.telegraph.x : v.x;
        const telegraphZ = targetPlaced ? v.telegraph.z : v.z;
        ring.position.set(telegraphX, this.world.groundHeight(telegraphX, telegraphZ) + 0.06, telegraphZ);
        ring.rotation.y = v.telegraph.kind === 'frontal_cone' ? v.yaw : 0;
        const progress = 1 - v.telegraph.ticks / Math.max(1, v.telegraph.totalTicks);
        const material = ring.material as THREE.MeshBasicMaterial;
        material.opacity = 0.28 + progress * 0.28 + Math.sin(this.clock * 12) * 0.05;
      } else if (ring) {
        this.scene.remove(ring);
        disposeMesh(ring);
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
    for (const [id, ring] of [...this.telegraphRings]) {
      if (!seen.has(id)) {
        this.scene.remove(ring);
        disposeMesh(ring);
        this.telegraphRings.delete(id);
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
        disposeMesh(mesh);
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
        disposeMesh(mesh);
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
    // Camera collision (D-023/D-025): use the same oriented props,
    // interior boundaries, and terrain obstruction as the authoritative sim.
    let d = this.cameraDistance;
    const dirX = -Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const dirZ = -Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
    const dirY = -Math.sin(this.cameraPitch);
    const eyeY = player.y + eye;
    const desired = {
      x: player.x + dirX * this.cameraDistance,
      y: eyeY + dirY * this.cameraDistance,
      z: player.z + dirZ * this.cameraDistance,
    };
    const obstruction = worldObstructionT(
      CONTENT,
      this.collision,
      this.world.currentSpace(),
      { x: player.x, y: eyeY, z: player.z },
      desired,
      this.world.seed(),
      0.22,
    );
    if (obstruction !== null) {
      d = Math.max(0.15, obstruction * this.cameraDistance - 0.2);
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
