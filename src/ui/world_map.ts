// Presentation-only world and interior maps. Authored geography is projected
// into SVG; destination markers never enter the sim, save, or wire protocol.

import { CONTENT } from '../sim/content';
import { ROAD_POINTS } from '../sim/world/terrain';

export interface MapPosition {
  x: number;
  z: number;
  yaw: number;
}

export interface MapWaypoint {
  id: string;
  name: string;
  spaceId: string;
  x: number;
  z: number;
  kind?: 'town' | 'ruin' | 'camp' | 'mine' | 'cave' | 'exit';
}

export interface MapRoom {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface MapDefinition {
  spaceId: string;
  name: string;
  kind: 'exterior' | 'interior';
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  road: readonly { x: number; z: number }[];
  rooms: readonly MapRoom[];
  landmarks: readonly MapWaypoint[];
}

const EXTERIOR_LANDMARKS: readonly MapWaypoint[] = [
  { id: 'falkmoor', name: 'Falkmoor Ruin', spaceId: 'kaldwyn', x: 40, z: -420, kind: 'ruin' },
  { id: 'road-camp', name: 'Redclaw Road Camp', spaceId: 'kaldwyn', x: 30, z: -300, kind: 'camp' },
  { id: 'thornmere', name: 'Thornmere Crossing', spaceId: 'kaldwyn', x: -10, z: -180, kind: 'town' },
  { id: 'gloamroot', name: 'Gloamroot Hollow', spaceId: 'kaldwyn', x: -10, z: -105, kind: 'cave' },
  { id: 'fenharrow', name: 'Fenharrow', spaceId: 'kaldwyn', x: 42, z: 158, kind: 'town' },
  { id: 'siltroot', name: 'Siltroot Burrow', spaceId: 'kaldwyn', x: -30, z: 75, kind: 'cave' },
  { id: 'weeping-stones', name: 'Weeping Stones', spaceId: 'kaldwyn', x: 93, z: 274, kind: 'ruin' },
  { id: 'duskhollow', name: 'Duskhollow Mine', spaceId: 'kaldwyn', x: 118, z: 338, kind: 'mine' },
];

function boundsFor(
  points: readonly { x: number; z: number }[],
  padding: number,
): MapDefinition['bounds'] {
  if (points.length === 0) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  return {
    minX: Math.min(...points.map((point) => point.x)) - padding,
    maxX: Math.max(...points.map((point) => point.x)) + padding,
    minZ: Math.min(...points.map((point) => point.z)) - padding,
    maxZ: Math.max(...points.map((point) => point.z)) + padding,
  };
}

export function mapDefinition(spaceId: string): MapDefinition {
  const space = CONTENT.spaces[spaceId];
  const name = space?.name ?? spaceId;
  if (space?.kind === 'interior' && space.interior) {
    const rooms = space.interior.rooms.map((room) => ({ ...room }));
    const landmarks = CONTENT.doors
      .filter((door) => door.spaceId === spaceId)
      .map((door): MapWaypoint => ({
        id: door.id,
        name: door.name,
        spaceId,
        x: door.x,
        z: door.z,
        kind: 'exit',
      }));
    const corners = rooms.flatMap((room) => [
      { x: room.x0, z: room.z0 },
      { x: room.x1, z: room.z1 },
    ]);
    return {
      spaceId,
      name,
      kind: 'interior',
      bounds: boundsFor([...corners, ...landmarks], 2),
      road: [],
      rooms,
      landmarks,
    };
  }
  const landmarks = spaceId === 'kaldwyn' ? EXTERIOR_LANDMARKS : [];
  const road = spaceId === 'kaldwyn' ? ROAD_POINTS : [];
  return {
    spaceId,
    name,
    kind: 'exterior',
    bounds: boundsFor([...road, ...landmarks], 34),
    road,
    rooms: [],
    landmarks,
  };
}

const MAP_WIDTH = 720;
const MAP_HEIGHT = 450;
const MAP_MARGIN = 28;

function project(map: MapDefinition, x: number, z: number): { x: number; y: number } {
  const width = Math.max(1, map.bounds.maxX - map.bounds.minX);
  const height = Math.max(1, map.bounds.maxZ - map.bounds.minZ);
  return {
    x: MAP_MARGIN + ((x - map.bounds.minX) / width) * (MAP_WIDTH - MAP_MARGIN * 2),
    y: MAP_HEIGHT - MAP_MARGIN - ((z - map.bounds.minZ) / height) * (MAP_HEIGHT - MAP_MARGIN * 2),
  };
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function markerGlyph(kind: MapWaypoint['kind']): string {
  if (kind === 'town') return '◆';
  if (kind === 'ruin') return '⌂';
  if (kind === 'camp') return '▲';
  if (kind === 'exit') return '⇥';
  return '●';
}

export function renderWorldMap(
  map: MapDefinition,
  player: MapPosition,
  waypoint: MapWaypoint | null,
): string {
  const playerPoint = project(map, player.x, player.z);
  const roadPath = map.road.map((point, index) => {
    const projected = project(map, point.x, point.z);
    return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
  }).join(' ');
  const roomShapes = map.rooms.map((room) => {
    const topLeft = project(map, room.x0, room.z1);
    const bottomRight = project(map, room.x1, room.z0);
    return `<rect class="map-room" x="${topLeft.x.toFixed(1)}" y="${topLeft.y.toFixed(1)}" ` +
      `width="${(bottomRight.x - topLeft.x).toFixed(1)}" height="${(bottomRight.y - topLeft.y).toFixed(1)}" />`;
  }).join('');
  const waypointLine = waypoint?.spaceId === map.spaceId ? (() => {
    const target = project(map, waypoint.x, waypoint.z);
    return `<path class="map-waypoint-line" d="M ${playerPoint.x.toFixed(1)} ${playerPoint.y.toFixed(1)} ` +
      `L ${target.x.toFixed(1)} ${target.y.toFixed(1)}" />`;
  })() : '';
  const markerShapes = map.landmarks.map((landmark) => {
    const point = project(map, landmark.x, landmark.z);
    const selected = waypoint?.spaceId === map.spaceId && waypoint.id === landmark.id;
    const labelAtLeft = point.x > MAP_WIDTH - 150;
    return `<g class="map-marker${selected ? ' map-marker--selected' : ''}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})">` +
      `<circle r="${selected ? 10 : 7}" /><text class="map-marker-glyph" y="4">${markerGlyph(landmark.kind)}</text>` +
      `<text class="map-marker-label" x="${labelAtLeft ? -12 : 12}" y="4"${labelAtLeft ? ' text-anchor="end"' : ''}>${esc(landmark.name)}</text></g>`;
  }).join('');
  const rotation = (player.yaw * 180) / Math.PI;
  const destinationRows = map.landmarks.length === 0
    ? '<div class="map-empty">No mapped destinations in this space.</div>'
    : map.landmarks.map((landmark) => {
      const selected = waypoint?.spaceId === map.spaceId && waypoint.id === landmark.id;
      const distance = Math.round(Math.hypot(landmark.x - player.x, landmark.z - player.z));
      return `<button type="button" class="map-destination${selected ? ' map-destination--selected' : ''}" ` +
        `data-act="map-waypoint" data-id="${esc(landmark.id)}" aria-pressed="${selected}">` +
        `<span>${esc(landmark.name)}</span><small>${distance} m</small></button>`;
    }).join('');

  return `<section class="panel map-panel" aria-label="${esc(map.name)} map">
    <div class="map-heading"><div><h2>${esc(map.name)}</h2><span>${map.kind === 'exterior' ? 'Survey map' : 'Floor plan'}</span></div>` +
      `<div class="map-coordinates">X ${Math.round(player.x)} · Z ${Math.round(player.z)}</div></div>
    <div class="map-layout">
      <svg class="world-map" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-label="${esc(map.name)} map">
        <title>${esc(map.name)} map with current position and destinations</title>
        <rect class="map-paper" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" />
        <path class="map-grid" d="M 180 0 V ${MAP_HEIGHT} M 360 0 V ${MAP_HEIGHT} M 540 0 V ${MAP_HEIGHT} M 0 112.5 H ${MAP_WIDTH} M 0 225 H ${MAP_WIDTH} M 0 337.5 H ${MAP_WIDTH}" />
        ${roadPath ? `<path class="map-road map-road-border" d="${roadPath}" /><path class="map-road" d="${roadPath}" />` : ''}
        ${roomShapes}${waypointLine}${markerShapes}
        <g data-map-player class="map-player" transform="translate(${playerPoint.x.toFixed(1)} ${playerPoint.y.toFixed(1)}) rotate(${rotation.toFixed(1)})">
          <path d="M 0 -12 L 8 10 L 0 6 L -8 10 Z" />
        </g>
        <g class="map-north" transform="translate(680 42)"><text text-anchor="middle">N</text><path d="M 0 8 L 0 27 M -5 14 L 0 8 L 5 14" /></g>
      </svg>
      <aside class="map-sidebar" aria-label="Mapped destinations"><h3>Destinations</h3>${destinationRows}` +
        `${waypoint ? `<button type="button" class="map-clear" data-act="map-clear">Clear marker</button>` : ''}` +
        `<div class="map-legend"><span><i class="legend-player"></i>You</span><span><i class="legend-place"></i>Location</span></div></aside>
    </div><div class="hint"><kbd>M</kbd> close · choose a destination for HUD bearing and distance</div></section>`;
}

function normalizeAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

export interface NavigationCue {
  distance: number;
  relativeBearing: number;
  direction: 'ahead' | 'right' | 'behind' | 'left';
}

export function navigationCue(player: MapPosition, waypoint: MapWaypoint): NavigationCue {
  const dx = waypoint.x - player.x;
  const dz = waypoint.z - player.z;
  const relativeBearing = normalizeAngle(Math.atan2(dx, dz) - player.yaw);
  const absolute = Math.abs(relativeBearing);
  const direction = absolute <= Math.PI / 4
    ? 'ahead'
    : absolute >= Math.PI * 3 / 4
      ? 'behind'
      : relativeBearing > 0 ? 'right' : 'left';
  return { distance: Math.hypot(dx, dz), relativeBearing, direction };
}

export function renderNavigationCue(player: MapPosition, waypoint: MapWaypoint): string {
  const cue = navigationCue(player, waypoint);
  const degrees = (cue.relativeBearing * 180) / Math.PI;
  return `<div class="navigation-cue" role="status" aria-label="Destination ${esc(waypoint.name)}, ` +
    `${Math.round(cue.distance)} meters ${cue.direction}"><span class="navigation-arrow" style="transform:rotate(${degrees.toFixed(1)}deg)">↑</span>` +
    `<span>${esc(waypoint.name)}</span><strong>${Math.round(cue.distance)} m</strong></div>`;
}

export const WORLD_MAP_CSS = `
  #hud .panel.map-panel { width: min(900px, calc(100vw - 48px)); max-width: 900px; max-height: 82vh; box-sizing: border-box; overflow: auto; }
  #hud .map-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 12px; }
  #hud .map-heading h2 { margin-bottom: 3px; }
  #hud .map-heading span, #hud .map-coordinates { color: #bcae88; font: 11px/1.3 ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing: .07em; text-transform: uppercase; }
  #hud .map-layout { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 14px; }
  #hud .world-map { width: 100%; min-height: 390px; border: 1px solid rgba(213,195,145,.5); border-radius: 3px; background: #24231f; }
  #hud .map-paper { fill: #292a26; }
  #hud .map-grid { fill: none; stroke: rgba(209,195,151,.07); stroke-width: 1; }
  #hud .map-road-border { fill: none; stroke: rgba(18,16,13,.9); stroke-width: 13; stroke-linecap: round; stroke-linejoin: round; }
  #hud .map-road { fill: none; stroke: #8d7b5e; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
  #hud .map-room { fill: rgba(120,113,94,.35); stroke: #b6a67b; stroke-width: 2; }
  #hud .map-marker circle { fill: #302a20; stroke: #d6c58e; stroke-width: 2; }
  #hud .map-marker--selected circle { fill: #6d5430; stroke: #ffe29a; stroke-width: 3; }
  #hud .map-marker text { fill: #eee2c1; font-family: Georgia, 'Times New Roman', serif; text-shadow: 0 1px 2px #000; }
  #hud .map-marker-glyph { font-size: 10px; text-anchor: middle; }
  #hud .map-marker-label { font-size: 12px; paint-order: stroke; stroke: #22221f; stroke-width: 3px; }
  #hud .map-player path { fill: #edf3ff; stroke: #27496b; stroke-width: 2; }
  #hud .map-waypoint-line { fill: none; stroke: #e8ca77; stroke-width: 2; stroke-dasharray: 6 5; }
  #hud .map-north { fill: #eadcae; stroke: #eadcae; font: bold 13px Georgia, serif; }
  #hud .map-sidebar { padding: 10px; background: rgba(3,4,5,.28); border: 1px solid rgba(216,197,145,.22); border-radius: 3px; }
  #hud .map-sidebar h3 { margin: 0 0 8px; color: #d8c890; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  #hud .map-destination, #hud .map-clear { display: flex; width: 100%; justify-content: space-between; gap: 10px; padding: 8px; margin: 3px 0; color: #e8e0cc; background: transparent; border: 1px solid transparent; border-radius: 3px; font: 13px Georgia, serif; text-align: left; cursor: pointer; }
  #hud .map-destination small { color: #b9aa83; white-space: nowrap; }
  #hud .map-destination:hover, #hud .map-destination--selected { background: rgba(200,180,120,.13); border-color: rgba(216,197,145,.3); }
  #hud .map-clear { margin-top: 10px; justify-content: center; border-color: rgba(216,197,145,.25); color: #cbbd98; }
  #hud .map-empty { color: #9f967e; font-size: 12px; line-height: 1.4; }
  #hud .map-legend { display: flex; gap: 14px; margin-top: 14px; color: #aaa087; font-size: 11px; }
  #hud .map-legend span { display: flex; align-items: center; gap: 5px; }
  #hud .map-legend i { width: 8px; height: 8px; display: inline-block; transform: rotate(45deg); }
  #hud .legend-player { background: #edf3ff; border: 1px solid #27496b; }
  #hud .legend-place { background: #302a20; border: 1px solid #d6c58e; border-radius: 50%; }
  #hud .navigation-cue { position: absolute; left: 50%; top: 48px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; min-width: 190px; justify-content: center; padding: 5px 10px; box-sizing: border-box; background: rgba(10,10,12,.76); border: 1px solid rgba(218,198,142,.35); border-radius: 4px; font-size: 12px; text-shadow: 0 1px 2px #000; }
  #hud .navigation-cue strong { color: #d8c890; font: 11px ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  #hud .navigation-arrow { display: inline-block; color: #ffe29a; font: bold 17px/1 sans-serif; }
  @media (max-width: 760px) {
    #hud .map-layout { grid-template-columns: 1fr; }
    #hud .world-map { min-height: 300px; }
    #hud .map-sidebar { max-height: 160px; overflow: auto; }
  }
`;
