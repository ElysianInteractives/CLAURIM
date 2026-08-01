# Map and navigation presentation contract

QA Phase H locks a useful current-space map and destination readout without
adding fast travel, route automation, map discovery state, or simulation
authority.

## Authored maps

- `M` opens the current space map and suppresses movement through the existing
  menu-capture boundary.
- Kaldwyn renders its authored road and current landmark catalog. D-043
  expands the original five destinations with Thornmere Crossing, Gloamroot
  Hollow, and Weeping Stones for eight total. Marker labels choose an inward
  anchor so edge destinations remain readable.
- Interiors project the exact authored room union and current-space exit door.
  Exterior landmarks never leak into an interior floor plan.
- Every view contains a north indicator, rounded X/Z readout, and a player
  arrow derived from the current authoritative position and yaw.

## Destination guidance

- The map lists current-space destinations with straight-line distance. A
  selection closes the map and shows destination name, accurate distance, and
  player-relative bearing on the HUD.
- The marker is presentation-only, session-local, and only displayed in its
  selected space. It is not a path request and does not change movement,
  navigation, quests, saves, snapshots, or the wire protocol.
- Selecting a current interior exit replaces an exterior marker. Players may
  clear the current marker from the map.

## Deliberate limits

The survey reveals the small authored slice and uses straight-line bearing; it
does not implement discovery fog, quest markers, cross-space route guidance,
path distance, fast travel, or persistent waypoints. Those require separate
locks when the world expands beyond the current region.

## Acceptance

Acceptance requires exterior landmark/road coverage, exact interior room
coverage, player heading, relative bearing/distance tests, semantic controls,
`npm run world:tour`, the full `npm run gate`, and direct exterior map,
destination HUD, and interior floor-plan browser checks at 1280x720 plus a
1920x1080 exterior pass with no clipping, overflow, or warning/error logs.
