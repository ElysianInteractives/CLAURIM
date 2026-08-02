# Claurim browser QA playtest guide

## Session setup

1. Open the [public QA build](https://elysianinteractives.github.io/CLAURIM/)
   in a desktop private/incognito window. This avoids loading an older save
   from the browser's `claurim_save_v1` storage slot.
2. Use a viewport of at least 1280x720. Record the browser, viewport, date, and
   operating system at the top of the session notes.
3. Confirm the game opens at Falkmoor Ruin with Health, Stamina, Magicka, two
   empty spell slots, and the controls card visible. Press `M` and confirm all
   eight destinations appear.
4. If the page is stale or blank, hard-refresh it with `Ctrl+Shift+R`. Check
   the [deployment workflow](https://github.com/ElysianInteractives/CLAURIM/actions/workflows/qa-pages.yml)
   before reporting a game defect.

The public Pages build is intentionally single-player. Do not append a `ws=`
address or treat unavailable multiplayer as a defect in this session.

## Controls

| Input | Action |
|---|---|
| `WASD` | Move |
| `Shift` | Sprint |
| `C` / `Space` | Sneak / jump |
| Mouse / `V` | Look / switch first- and third-person camera |
| Left / right mouse | Attack / block |
| `1` / `2` | Cast equipped spells along the center reticle |
| `E` | Interact, talk, enter, or loot |
| `Tab` | Inventory, equipment, known spells, and spell slots |
| `M` | Map and destination guidance |
| `J` / `P` | Journal / perks |
| `F5` / `F9` | Save / load |
| `H` / `Esc` | Toggle controls / close or open settings |

## Recommended pass

Run these in order so one clean save covers the whole session.

### 1. Boot, movement, and camera

- Walk, strafe, jump, sneak, and rotate the camera in both viewpoints.
- Hold sprint until Stamina reaches zero. Sprint must stop, remain unavailable
  until its restart threshold, and recover normally afterward.
- Back the third-person camera toward terrain and structures. The center
  reticle should remain clear and the camera should not pass through solids.

### 2. Combat and loadout

- Fight a hostile near Falkmoor or the Redclaw road camp. Check attack
  buffering, frontal blocking, target health, hit feedback, and death/recovery.
- Open `Tab`. Equipped items must occupy the six fixed equipment slots and not
  also appear in the carried-item list.
- After obtaining a spell primer, use its **Study** action, assign the learned
  spell to slot 1 or 2, and cast it. Projectile spells must follow the reticle's
  horizontal and vertical trajectory.

### 3. World and wildlife

- Use `M` to select destinations and follow the HUD bearing rather than
  assuming the road is the only route.
- Visit Thornmere Crossing, Gloamroot Hollow, Fenharrow, Weeping Stones,
  Siltroot Burrow, and Duskhollow Mine.
- At Thornmere, confirm scheduled residents move without pressing into walls.
  Ridge harts should wander without becoming hostile; briarboars should be
  hostile and visually distinct.
- At Fenharrow, Thornmere, and Weeping Stones, walk and rotate the camera with
  buildings plus moving residents or wildlife visible at mid-distance. Motion
  should remain smooth; static structures must not shiver against the terrain
  or horizon. If it recurs, record at least ten seconds with the viewport and
  exact location noted.
- At Fenharrow, stand close enough that a building compresses the third-person
  camera, then walk/turn until it clears. The camera must pull inward promptly
  but recover outward continuously; the entire scene must never snap between
  the NPCs and static buildings. Repeat in the Fenharrow Hearth near a wall.
- If the device is under sustained graphics load, image sharpness may step
  down before surrounding model detail steps down; the controlled player must
  remain high detail. Both recover only after several stable seconds.
  Report continued frame skips with viewport, display scaling, browser, and a
  ten-second recording.
- For a development performance capture, add `?qaPerf=1` to log five-second
  FPS/draw/triangle/tier windows. `?qa=thornmere&qaPerf=1&qaWalk=1` supplies a
  repeatable Find7-style route; `qaWalk` is ignored in production.
- Approach and leave a resident, hart, briarboar, and settlement building.
  Close silhouettes should be smooth and detailed; distance transitions
  should not flicker repeatedly, drop equipped gear, break poses, or alter
  collision. Compare first- and third-person equipment at close range.
- Sweep the camera across dense vegetation while walking between near and
  outer terrain cells. Tree/rock density and color should remain continuous;
  report obvious popping, missing patches, or renewed frame jitter with the
  exact location and camera direction.
- In Gloamroot, confirm the arrival faces into a readable cavern, every room is
  traversable, glowcaps light the route, and the matriarch encounter is usable.

### 4. Quests and dialogue

- Talk to **Tamsin Reed** in Thornmere and accept **A Bitter Root**. Verify the
  journal sends you to Gloamroot, credits four briarboars plus the matriarch,
  and displays Tamsin's authored return conversation before the completed
  greeting.
- Talk to **Vael Orin** and accept **The Stone Toll**. Verify the Weeping Stones
  discovery, two-briarboar objective, return conversation, and reward.
- Talk to **Corren Pike** before and after A Bitter Root; his dialogue should
  react to its state.
- At Fenharrow, enter the Fenharrow Hearth and begin **The Hollow Delve** with
  Maera. Check its gate, mine, journal, Warden, and visible turn-in progression.

### 5. Persistence and presentation

- Press `F5`, refresh the page, and verify the saved world resumes. Then make a
  small change and use `F9` to confirm manual load behavior.
- Recheck `Tab`, `J`, `P`, `M`, and `Esc` at 1280x720. Panels must remain
  readable without overlapping the resource display or spell quickbar.
- Repeat one combat scene and one dialogue at a larger desktop viewport when
  possible.

## Recording findings

Keep the existing `QA` folder organized by session:

```text
QA/
  2026-08-01-session-02/
    notes.md
    images/
    recordings/
```

Use one entry per independently observable issue:

```text
ID: QA-001
Severity: Blocker / High / Medium / Low
Area: Movement / Combat / World / AI / Inventory / Magic / Quest / UI / Save
Location and quest stage:
Expected:
Actual:
Steps to reproduce:
Frequency: Always / Often / Once
Browser, viewport, and OS:
Save state: Fresh / Continued / Loaded with F9
Evidence files:
```

Record the first clear reproduction rather than several minutes of unrelated
play. For progression or persistence failures, preserve the save state and
note the last successful objective or interaction. Do not clear site data
after a failure until its evidence has been captured.

## Severity guide

- **Blocker:** cannot boot, continue, save/load, or complete a required path.
- **High:** combat, movement, quest, inventory, or persistence is materially
  broken with no practical workaround.
- **Medium:** repeatable behavior or presentation defect with a workaround.
- **Low:** polish, wording, alignment, or isolated visual issue.
