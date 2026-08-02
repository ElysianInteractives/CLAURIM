// SimWorld: adapts a local Sim to the IWorld seam FOR ONE CHARACTER. This is
// the only host-side file allowed to import Sim concretely (guarded). The
// offline browser host binds the primary character; multiplayer server-side
// views and tests may bind any character.

import { Sim, type CharacterId } from '../sim/sim';
import { skillXpForLevel, xpForLevel, SKILL_IDS, type Actor, type ContentId, type SimEvent } from '../sim/types';
import { groundHeight } from '../sim/world/spaces';
import type {
  ActorView,
  DialogueView,
  GroundAoeView,
  IWorld,
  JournalView,
  LootItemView,
  PartyMemberView,
  ProjectileView,
  ShopView,
} from '../world_api';
import type { PerkView } from '../world_api/menus';
import { buyPrice, sellPrice } from '../sim/inventory/inventory';
import {
  equipmentView,
  equippedSpellView,
  equippedConsumableView,
  inventoryView,
  itemDetail,
  knownSpellView,
} from './loadout_view';

export class SimWorld implements IWorld {
  readonly charId: CharacterId;

  constructor(
    public sim: Sim,
    charId?: CharacterId,
  ) {
    this.charId = charId ?? sim.primaryCharId ?? 'p1';
  }

  private actor(): Actor {
    const a = this.sim.playerActor(this.charId);
    if (!a) throw new Error(`character ${this.charId} not in world`);
    return a;
  }

  // --- read ---------------------------------------------------------------

  seed(): number {
    return this.sim.seed;
  }

  currentSpace() {
    return this.actor().pos.spaceId;
  }

  spaceName(spaceId: string): string {
    return this.sim.content.spaces[spaceId]?.name ?? spaceId;
  }

  spaceKind(spaceId: string): 'exterior' | 'interior' {
    return this.sim.content.spaces[spaceId]?.kind ?? 'exterior';
  }

  gameHours(): number {
    return this.sim.gameHours();
  }

  private toView(a: Actor): ActorView {
    const tpl = this.sim.content.actors[a.templateId];
    const self = this.actor();
    const attack = a.attack;
    const ability = attack?.abilityId ? tpl?.abilities?.find((candidate) => candidate.id === attack.abilityId) : undefined;
    let telegraph: ActorView['telegraph'];
    if (attack?.telegraph && attack.phase === 'windup' && ability) {
      let x = a.pos.x;
      let z = a.pos.z;
      if (ability.kind === 'ground_aoe' && a.brain) {
        const target = this.sim.actors.get(a.brain.targetId);
        if (target?.pos.spaceId === a.pos.spaceId) {
          x = target.pos.x;
          z = target.pos.z;
        }
      }
      telegraph = {
        kind: ability.kind,
        ticks: attack.t,
        totalTicks: ability.telegraphTicks,
        interruptible: ability.interruptible,
        range: ability.range ?? 3,
        angleDegrees: ability.coneDegrees ?? 90,
        radius: ability.aoeRadius ?? 1.6,
        x,
        z,
      };
    }
    return {
      id: a.id,
      templateId: a.templateId,
      archetype: a.kind === 'player' ? 'player' : (tpl?.archetype ?? 'villager_m'),
      name: a.name,
      x: a.pos.x,
      y: a.pos.y,
      z: a.pos.z,
      yaw: a.yaw,
      aimPitch: a.aimPitch,
      dead: a.dead,
      downed: a.downed,
      health: a.health,
      maxHealth: a.stats.maxHealth,
      sneaking: a.sneaking,
      blocking: a.blocking,
      attacking: a.attack !== null && a.attack.phase !== 'recover',
      attackKind: a.attack?.kind ?? null,
      attackPhase: a.attack?.phase ?? null,
      telegraphTicks: a.attack?.telegraph && a.attack.phase === 'windup' ? a.attack.t : 0,
      equipment: { ...a.equipment },
      telegraph,
      isPlayer: a.kind === 'player',
      isRemotePlayer: a.kind === 'player' && a.id !== self.id,
      hostileToPlayer: a.kind !== 'player' && this.sim.isHostile(self, a),
      hasDialogue: !!tpl?.dialogueId,
      tier: tpl?.tier ?? 'standard',
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

  groundAoesInSpace(): GroundAoeView[] {
    const space = this.currentSpace();
    return this.sim.groundAoes
      .filter((g) => g.spaceId === space)
      .map((g) => ({ id: g.id, x: g.x, z: g.z, radius: g.radius }));
  }

  player(): ActorView {
    return this.toView(this.actor());
  }

  partyId(): string | null {
    return this.sim.partyOf(this.charId);
  }

  party(): PartyMemberView[] {
    return this.sim.partyMembersOf(this.charId).map((memberId) => {
      const a = this.sim.playerActor(memberId);
      return {
        charId: memberId,
        entityId: a?.id ?? null,
        name: a?.name ?? this.sim.characterNames.get(memberId) ?? memberId,
        health: a?.health ?? 0,
        maxHealth: a?.stats.maxHealth ?? 1,
        downed: a?.downed ?? false,
        spaceId: a?.pos.spaceId ?? 'kaldwyn',
        isSelf: memberId === this.charId,
        online: a !== null,
      };
    });
  }

  partyInvites() {
    const invite = this.sim.pendingPartyInviteFor(this.charId);
    return invite ? [invite] : [];
  }

  playerResources() {
    const p = this.actor();
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
    const p = this.actor();
    return SKILL_IDS.map((id) => ({
      id,
      level: p.skills[id].level,
      xp: p.skills[id].xp,
      xpForNext: skillXpForLevel(p.skills[id].level),
    }));
  }

  playerInventory() {
    return inventoryView(this.actor(), this.sim.content);
  }

  playerEquipment() {
    return equipmentView(this.actor(), this.sim.content);
  }

  knownSpells() {
    return knownSpellView(this.sim.knownSpellsBy.get(this.charId) ?? [], this.sim.content);
  }

  equippedSpells() {
    return equippedSpellView(this.sim.spellLoadoutFor(this.charId), this.sim.content);
  }

  equippedConsumables() {
    return equippedConsumableView(this.sim.consumableLoadoutFor(this.charId), this.actor(), this.sim.content);
  }

  /** Filter tick events to this player's view: own progression/quests, plus
   * shared local happenings (combat, chat, boss events). */
  private eventVisible(e: SimEvent): boolean {
    const selfId = this.actor().id;
    switch (e.type) {
      case 'skillUp':
      case 'levelUp':
        return e.playerId === selfId;
      case 'questStarted':
      case 'questAdvanced':
      case 'questCompleted':
      case 'objectiveProgress':
        return e.charId === this.charId;
      case 'itemAdded':
      case 'itemRemoved':
        return e.actorId === selfId;
      case 'spellLearned':
        return e.charId === this.charId;
      case 'actionRejected':
        return e.actorId === selfId;
      case 'spaceEntered':
      case 'talkedTo':
      case 'playerRecovered':
      case 'recoveryRejected':
        return e.playerId === selfId;
      case 'interacted':
        return e.actorId === selfId;
      default:
        return true;
    }
  }

  drainEvents(): SimEvent[] {
    // NOTE: with multiple local views over one sim, drain consumes for all;
    // the offline host has exactly one view. The server host distributes
    // events per player itself (server/core.ts) and does not use this path.
    const events = this.sim.events;
    this.sim.events = [];
    return events.filter((e) => this.eventVisible(e));
  }

  nearestInteractablePrompt(): string | null {
    const t = this.sim.nearestInteractableFor(this.charId);
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
      case 'revive':
        return `Revive ${t.name}`;
    }
  }

  groundHeight(x: number, z: number): number {
    return groundHeight(this.sim.content, this.currentSpace(), x, z, this.sim.seed);
  }

  playerDowned(): boolean {
    return this.actor().downed;
  }

  downedTicksLeft(): number {
    return this.actor().downedTicks;
  }

  // --- intent -------------------------------------------------------------

  step(input: Parameters<IWorld['step']>[0]): void {
    // Offline host: one local character drives the tick.
    this.sim.tick(new Map([[this.charId, input]]));
  }

  attackMelee(): boolean {
    return this.sim.meleeFor(this.charId);
  }

  attackRanged(): boolean {
    return this.sim.rangedFor(this.charId);
  }

  castSpell(spellId: ContentId): boolean {
    return this.sim.castFor(this.charId, spellId);
  }

  interact() {
    const result = this.sim.interactFor(this.charId);
    return result === 'revive' ? 'none' : result;
  }

  useItem(itemId: ContentId): boolean {
    return this.sim.useItemFor(this.charId, itemId);
  }

  equipItem(itemId: ContentId): boolean {
    return this.sim.equipFor(this.charId, itemId);
  }

  unequipItem(slot: Parameters<IWorld['unequipItem']>[0]): boolean {
    return this.sim.unequipFor(this.charId, slot);
  }

  equipSpell(slot: Parameters<IWorld['equipSpell']>[0], spellId: ContentId): boolean {
    return this.sim.equipSpellFor(this.charId, slot, spellId);
  }

  unequipSpell(slot: Parameters<IWorld['unequipSpell']>[0]): boolean {
    return this.sim.unequipSpellFor(this.charId, slot);
  }

  equipConsumable(slot: Parameters<IWorld['equipConsumable']>[0], itemId: ContentId): boolean {
    return this.sim.equipConsumableFor(this.charId, slot, itemId);
  }

  unequipConsumable(slot: Parameters<IWorld['unequipConsumable']>[0]): boolean {
    return this.sim.unequipConsumableFor(this.charId, slot);
  }

  takePerk(perkId: ContentId): boolean {
    return this.sim.takePerkFor(this.charId, perkId);
  }

  respawn(): void {
    this.sim.releasePlayer(this.charId);
  }

  recover(): boolean {
    return this.sim.recoverPlayer(this.charId) === 'recovered';
  }

  saveGame(): string {
    return this.sim.saveToJson();
  }

  chat(text: string): void {
    this.sim.chatFrom(this.charId, text);
  }

  partyInvite(targetEntityId: number): void {
    this.sim.inviteToParty(this.charId, targetEntityId);
  }

  partyAccept(): void {
    this.sim.acceptPartyInvite(this.charId);
  }

  partyDecline(): void {
    this.sim.declinePartyInvite(this.charId);
  }

  partyLeave(): void {
    this.sim.leaveParty(this.charId);
  }

  // --- menus --------------------------------------------------------------

  lootView() {
    const session = this.sim.lootSessionFor(this.charId);
    if (!session) return null;
    const items: LootItemView[] = session.contents.items.filter((stack) => stack.count > 0).map((stack) => {
      const item = this.sim.content.items[stack.itemId];
      return {
        itemId: stack.itemId,
        name: item?.name ?? stack.itemId,
        count: stack.count,
        kind: item?.kind ?? 'misc',
        value: item?.value ?? 0,
        weight: item?.weight ?? 0,
        detail: itemDetail(item),
      };
    });
    if (session.contents.gold > 0) {
      items.push({ itemId: '__gold', name: 'Gold', count: session.contents.gold, kind: 'currency', value: 1, weight: 0, detail: 'Common coin' });
    }
    return { sourceKind: session.kind, sourceName: session.name, items } as const;
  }

  lootTake(itemId: ContentId | '__gold'): boolean {
    return this.sim.lootTakeFor(this.charId, itemId);
  }

  lootTakeAll(): boolean {
    return this.sim.lootTakeAllFor(this.charId);
  }

  lootClose(): void {
    this.sim.lootCloseFor(this.charId);
  }

  dialogueView(): DialogueView | null {
    const node = this.sim.dialogueNodeFor(this.charId);
    const session = this.sim.dialogueSessions.get(this.charId);
    if (!node || !session) return null;
    const npc = this.sim.actors.get(session.npcId);
    return {
      speakerName: npc?.name ?? '???',
      text: node.text,
      choices: this.sim.dialogueChoicesFor(this.charId).map((c) => c.text),
    };
  }

  dialogueChoose(index: number): void {
    this.sim.dialogueChooseFor(this.charId, index);
  }

  dialogueEnd(): void {
    this.sim.dialogueEndFor(this.charId);
  }

  shopView(): ShopView | null {
    const merchantId = this.sim.shopMerchantBy.get(this.charId);
    if (!merchantId) return null;
    const merchant = this.sim.actors.get(merchantId);
    if (!merchant) return null;
    const ctx = this.sim.context();
    const player = this.actor();
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
    return this.sim.shopBuyFor(this.charId, itemId);
  }

  shopSell(itemId: ContentId): boolean {
    return this.sim.shopSellFor(this.charId, itemId);
  }

  shopClose(): void {
    this.sim.shopCloseFor(this.charId);
  }

  journal(): JournalView[] {
    return this.sim.journalOf(this.charId);
  }

  perks(): PerkView[] {
    const p = this.actor();
    return Object.values(this.sim.content.perks).map((perk) => {
      const check = this.sim.canTakePerkFor(this.charId, perk.id);
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
