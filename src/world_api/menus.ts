// Menu facet: dialogue, shop, journal, and perk views for the UI layer.

import type { ContentId, SkillId } from '../sim/types';

export interface DialogueView {
  speakerName: string;
  text: string;
  choices: string[];
}

export interface ShopView {
  merchantName: string;
  merchantGold: number;
  stock: { itemId: ContentId; name: string; count: number; price: number }[];
  sellable: { itemId: ContentId; name: string; count: number; price: number }[];
}

export interface JournalView {
  questId: ContentId;
  name: string;
  stageJournal: string;
  completed: boolean;
  objectives: { text: string; progress: number; required: number; done: boolean; optional: boolean }[];
}

export interface LootItemView {
  itemId: ContentId | '__gold';
  name: string;
  count: number;
  kind: string;
  value: number;
  weight: number;
  detail: string;
}

export interface LootView {
  sourceKind: 'container' | 'corpse';
  sourceName: string;
  items: LootItemView[];
}

export interface PerkView {
  id: ContentId;
  name: string;
  description: string;
  skill: SkillId;
  requiredSkillLevel: number;
  owned: boolean;
  available: boolean;
  reason: string;
}

export interface MenuFacet {
  lootView(): LootView | null;
  lootTake(itemId: ContentId | '__gold'): boolean;
  lootTakeAll(): boolean;
  lootClose(): void;
  dialogueView(): DialogueView | null;
  dialogueChoose(index: number): void;
  dialogueEnd(): void;
  shopView(): ShopView | null;
  shopBuy(itemId: ContentId): boolean;
  shopSell(itemId: ContentId): boolean;
  shopClose(): void;
  journal(): JournalView[];
  perks(): PerkView[];
}
