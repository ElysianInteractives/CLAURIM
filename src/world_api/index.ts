// IWorld: the ONLY seam the renderer, UI, and hosts may use to observe the
// world and submit player intent (LOCKED D-001). Facet interfaces live in the
// sibling files; this barrel re-aggregates them. Hosts adapt a Sim (offline)
// or, later, a server mirror (online) to this interface; render/ui must never
// import Sim concretely.

import type { WorldReadFacet } from './world_read';
import type { PlayerIntentFacet } from './player_intent';
import type { MenuFacet } from './menus';

export type { ActorView, ProjectileView, WorldReadFacet } from './world_read';
export type { PlayerIntentFacet } from './player_intent';
export type { MenuFacet, DialogueView, ShopView, JournalView } from './menus';

export interface IWorld extends WorldReadFacet, PlayerIntentFacet, MenuFacet {}
