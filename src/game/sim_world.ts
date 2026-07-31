// SimWorld: adapts the offline Sim to the IWorld seam. This is the ONLY file
// on the host side allowed to import Sim concretely; render/ui consume IWorld.

import { Sim } from '../sim/sim';
import { skillXpForLevel, xpForLevel, SKILL_IDS, type ContentId, type SimEvent } from '../sim/types';
import { groundHeight } from '../sim/world/spaces';
import type {
  ActorView,
  DialogueView,
  IWorld,
  JournalView,
  ProjectileView,
  ShopView,
} from '../world_api';
import type { PerkView } from '../world_api/menus';
import { buyPrice, countItem, sellPrice } from '../sim/inventory/inventory';

export class SimWorld implements IWorld {
  constructor(public sim: Sim) {}

  // --- read ---------------------------------------------------------------

  seed(): number {
    return this.sim.seed;
  }

  currentSpace() {
    return this.sim.player().pos.spaceId;
  }

  spaceKind(spaceId: string): 'exterior' | 'interior' {
    return this.sim.content.spaces[spaceId]?.kind ?? 'exterior';
  }

  gameHours(): number {
    return this.sim.gameHours();
  }

  private toView(a: import('../sim/types').Actor): ActorView {
    const tpl = this.sim.content.actors[a.templateId];
    return {
      id: a.id,
      templateId: a.templateId,
      archetype: a.kind === 'player' ? 'player' : (tpl?.archetype ?? 'villager_m'),
      name: a.name,
      x: a.pos.x,
      y: a.pos.y,
      z: a.pos.z,
      yaw: a.yaw,
      dead: a.dead,
      health: a.health,
      maxHealth: a.stats.maxHealth,
      sneaking: a.sneaking,
      blocking: a.blocking,
      attacking: a.attack !== null && a.attack.phase !== 'recover',
      attackKind: a.attack?.kind ?? null,
      isPlayer: a.kind === 'player',
      hostileToPlayer: a.kind !== 'player' && this.sim.isHostile(this.sim.player(), a),
      hasDialogue: !!tpl?.dialogueId,
    };
  }

  actorsInSpace(): ActorView[] {
    const space = this.currentSpace();
    const out: ActorView[] = [];
    for (const a of this.sim.actors.values()) {
      if (a.pos.spaceId === space) out.push(this.toView(a));
    }
    return out;
  }

  projectilesInSpace(): ProjectileView[] {
    const space = this.currentSpace();
    return this.sim.projectiles
      .filter((p) => p.spaceId === space)
      .map((p) => ({ id: p.id, x: p.pos.x, y: p.pos.y, z: p.pos.z, kind: p.kind, channel: p.channel }));
  }

  player(): ActorView {
    return this.toView(this.sim.player());
  }

  playerResources() {
    const p = this.sim.player();
    return {
      health: p.health,
      maxHealth: p.stats.maxHealth,
      stamina: p.stamina,
      maxStamina: p.stats.maxStamina,
      magicka: p.magicka,
      maxMagicka: p.stats.maxMagicka,
      level: p.level,
      xp: p.characterXp,
      xpForNext: xpForLevel(p.level),
      perkPoints: p.perkPoints,
      gold: p.gold,
    };
  }

  playerSkills() {
    const p = this.sim.player();
    return SKILL_IDS.map((id) => ({
      id,
      level: p.skills[id].level,
      xp: p.skills[id].xp,
      xpForNext: skillXpForLevel(p.skills[id].level),
    }));
  }

  playerInventory() {
    const p = this.sim.player();
    const equipped = new Set(Object.values(p.equipment));
    return p.inventory.map((s) => {
      const item = this.sim.content.items[s.itemId];
      return {
        itemId: s.itemId,
        name: item?.name ?? s.itemId,
        count: s.count,
        equipped: equipped.has(s.itemId),
        kind: item?.kind ?? 'misc',
        value: item?.value ?? 0,
      };
    });
  }

  knownSpells() {
    return this.sim.playerKnownSpells.map((id) => {
      const sp = this.sim.content.spells[id];
      return { id, name: sp?.name ?? id, cost: sp?.magickaCost ?? 0 };
    });
  }

  drainEvents(): SimEvent[] {
    const events = this.sim.events;
    this.sim.events = [];
    return events;
  }

  nearestInteractablePrompt(): string | null {
    const t = this.sim.nearestInteractable();
    if (!t) return null;
    switch (t.kind) {
      case 'door':
        return `Enter ${t.name}`;
      case 'container':
        return `Open ${t.name}`;
      case 'npc':
        return `Talk to ${t.name}`;
      case 'corpse':
        return `Loot ${t.name}`;
    }
  }

  groundHeight(x: number, z: number): number {
    return groundHeight(this.sim.content, this.currentSpace(), x, z, this.sim.seed);
  }

  playerDead(): boolean {
    return this.sim.player().dead;
  }

  // --- intent -------------------------------------------------------------

  step(input: Parameters<IWorld['step']>[0]): void {
    this.sim.tick(input);
  }

  attackMelee(): boolean {
    return this.sim.playerMelee();
  }

  attackRanged(): boolean {
    return this.sim.playerRanged();
  }

  castSpell(spellId: ContentId): boolean {
    return this.sim.playerCast(spellId);
  }

  interact() {
    return this.sim.interact();
  }

  useItem(itemId: ContentId): boolean {
    return this.sim.playerUseItem(itemId);
  }

  equipItem(itemId: ContentId): boolean {
    return this.sim.playerEquip(itemId);
  }

  takePerk(perkId: ContentId): boolean {
    return this.sim.playerTakePerk(perkId);
  }

  respawn(): void {
    this.sim.respawnPlayer();
  }

  saveGame(): string {
    return this.sim.saveToJson();
  }

  // --- menus --------------------------------------------------------------

  dialogueView(): DialogueView | null {
    const node = this.sim.dialogueNode();
    if (!node || !this.sim.dialogue) return null;
    const npc = this.sim.actors.get(this.sim.dialogue.npcId);
    return {
      speakerName: npc?.name ?? '???',
      text: node.text,
      choices: this.sim.dialogueChoices().map((c) => c.text),
    };
  }

  dialogueChoose(index: number): void {
    this.sim.dialogueChoose(index);
  }

  dialogueEnd(): void {
    this.sim.dialogueEnd();
  }

  shopView(): ShopView | null {
    if (this.sim.shopMerchantId === 0) return null;
    const merchant = this.sim.actors.get(this.sim.shopMerchantId);
    if (!merchant) return null;
    const ctx = this.sim.context();
    const player = this.sim.player();
    const stock = merchant.inventory.map((s) => ({
      itemId: s.itemId,
      name: this.sim.content.items[s.itemId]?.name ?? s.itemId,
      count: s.count,
      price: buyPrice(ctx, player, s.itemId),
    }));
    const sellable = player.inventory
      .filter((s) => this.sim.content.items[s.itemId]?.kind !== 'quest')
      .map((s) => ({
        itemId: s.itemId,
        name: this.sim.content.items[s.itemId]?.name ?? s.itemId,
        count: s.count,
        price: sellPrice(ctx, player, s.itemId),
      }));
    return { merchantName: merchant.name, merchantGold: merchant.gold, stock, sellable };
  }

  shopBuy(itemId: ContentId): boolean {
    return this.sim.shopBuy(itemId);
  }

  shopSell(itemId: ContentId): boolean {
    return this.sim.shopSell(itemId);
  }

  shopClose(): void {
    this.sim.shopClose();
  }

  journal(): JournalView[] {
    return this.sim.journal();
  }

  perks(): PerkView[] {
    const p = this.sim.player();
    return Object.values(this.sim.content.perks).map((perk) => {
      const check = this.sim.playerCanTakePerk(perk.id);
      return {
        id: perk.id,
        name: perk.name,
        description: perk.description,
        skill: perk.skill,
        requiredSkillLevel: perk.requiredSkillLevel,
        owned: p.perks.includes(perk.id),
        available: check.ok,
        reason: check.reason,
      };
    });
  }
}

// Keep countItem imported for future intent methods without a lint suppression.
void countItem;
