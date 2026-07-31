// Quest + dialogue content for the vertical slice. All prose is original.
// Exemplar shapes: multi-stage quest with kill/collect/talkTo/reach objectives,
// an optional objective, conditional dialogue entries, quest acquisition and
// turn-in through dialogue, and a merchant shop hook.

import type { DialogueDef, QuestDef } from './schema';

export const QUESTS: Record<string, QuestDef> = {
  hollow_delve: {
    id: 'hollow_delve',
    name: 'The Hollow Delve',
    stages: [
      {
        id: 'entrance',
        journal:
          'Maera Fenn asked me to find Hadrin, a prospector who never returned from Duskhollow Mine. Redclaw raiders have camped at the mine gate.',
        objectives: [
          { id: 'clear_gate', kind: 'kill', target: 'redclaw_raider', count: 2, text: 'Drive off the Redclaw raiders at the mine gate' },
          { id: 'reach_mine', kind: 'reach', target: 'kaldwyn:118:338:10', count: 1, text: 'Reach the entrance of Duskhollow Mine' },
        ],
        next: 'delve',
      },
      {
        id: 'delve',
        journal:
          'The mine gate is clear. I should search Duskhollow Mine for any trace of Hadrin.',
        objectives: [
          { id: 'find_journal', kind: 'collect', target: 'prospectors_journal', count: 1, text: "Find a trace of Hadrin in Duskhollow Mine" },
          { id: 'ore_sample', kind: 'collect', target: 'duskhollow_ore', count: 1, text: 'Recover a pale ore sample (optional)', optional: true },
        ],
        next: 'warden',
      },
      {
        id: 'warden',
        journal:
          "Hadrin's journal tells of a pale thing that walks the deep vault. Whatever took him is still down here.",
        objectives: [
          { id: 'slay_warden', kind: 'kill', target: 'barrow_wight', count: 1, text: 'Destroy the Pale Warden' },
        ],
        next: 'return',
      },
      {
        id: 'return',
        journal:
          'The Pale Warden is destroyed. Maera deserves to know what became of Hadrin.',
        objectives: [
          { id: 'tell_maera', kind: 'talkTo', target: 'maera', count: 1, text: 'Return to Maera Fenn' },
        ],
        next: 'done',
      },
    ],
    reward: {
      gold: 100,
      items: [{ itemId: 'healing_draught', count: 2 }],
      xp: 120,
    },
  },
};

export const DIALOGUES: Record<string, DialogueDef> = {
  maera_dialogue: {
    id: 'maera_dialogue',
    entries: [
      { conditions: [{ kind: 'questCompleted', questId: 'hollow_delve' }], node: 'after' },
      { conditions: [{ kind: 'questAtStage', questId: 'hollow_delve', stageId: 'return' }], node: 'turnin' },
      { conditions: [{ kind: 'questAtStage', questId: 'hollow_delve', stageId: 'entrance' }], node: 'progress' },
      { conditions: [{ kind: 'questAtStage', questId: 'hollow_delve', stageId: 'delve' }], node: 'progress' },
      { conditions: [{ kind: 'questAtStage', questId: 'hollow_delve', stageId: 'warden' }], node: 'progress' },
      { node: 'greet' },
    ],
    nodes: [
      {
        id: 'greet',
        text: "Welcome to the Hearth, stranger. Warm yourself. Though I'll not pretend all is well here: a friend of mine went up to Duskhollow and never came back.",
        choices: [
          { text: 'Tell me about your friend.', next: 'offer' },
          { text: 'Let me see your goods.', actions: [{ kind: 'openShop' }], next: 'end' },
          { text: 'Just passing through.', next: 'end' },
        ],
      },
      {
        id: 'offer',
        text: "Hadrin. A prospector, stubborn as stone. He swore the old mine held pale ore worth a fortune. That was nine days ago. Now Redclaw banners hang at the gate. Will you look for him? I can pay.",
        choices: [
          { text: "I'll find him.", actions: [{ kind: 'startQuest', questId: 'hollow_delve' }], next: 'accepted' },
          { text: 'Not my trouble.', next: 'end' },
        ],
      },
      {
        id: 'accepted',
        text: 'Thank you. The mine lies northeast, past the last bend of the road. Mind the raiders, they do not bargain.',
        choices: [{ text: 'I will return.', next: 'end' }],
      },
      {
        id: 'progress',
        text: 'Any word of Hadrin? The road northeast, past the bend. I keep the stew warm for him, fool that I am.',
        choices: [
          { text: 'Still searching.', next: 'end' },
          { text: 'Let me see your goods.', actions: [{ kind: 'openShop' }], next: 'end' },
        ],
      },
      {
        id: 'turnin',
        text: 'You came back. Your face tells me half of it. Say the rest.',
        choices: [
          { text: 'Hadrin is dead. The thing that killed him is destroyed.', next: 'reward' },
        ],
      },
      {
        id: 'reward',
        text: 'Then he rests, and the mine is clean. That is worth more than coin, but take the coin anyway. Fenharrow remembers its friends.',
        choices: [{ text: 'Thank you, Maera.', next: 'end' }],
      },
      {
        id: 'after',
        text: 'The Hearth is yours whenever you pass, friend of Fenharrow.',
        choices: [
          { text: 'Let me see your goods.', actions: [{ kind: 'openShop' }], next: 'end' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
    ],
  },

  bronn_dialogue: {
    id: 'bronn_dialogue',
    entries: [{ node: 'greet' }],
    nodes: [
      {
        id: 'greet',
        text: 'Mind the sparks. Bronn Hale, smith of Fenharrow. If you mean to walk the north road, walk it in good steel.',
        choices: [
          { text: 'Any advice for a fighter?', next: 'advice' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
      {
        id: 'advice',
        text: 'Keep your shield up and your feet under you. A blade you cannot lift is worse than no blade at all.',
        choices: [{ text: 'I will remember.', next: 'end' }],
      },
    ],
  },

  ysolde_dialogue: {
    id: 'ysolde_dialogue',
    entries: [
      { conditions: [{ kind: 'questAtStage', questId: 'hollow_delve', stageId: 'entrance' }], node: 'hint' },
      { node: 'greet' },
    ],
    nodes: [
      {
        id: 'greet',
        text: 'Ysolde. I hunt the reach. Wolves grow bold near the river bend lately, so keep an arrow nocked.',
        choices: [{ text: 'Thanks for the warning.', next: 'end' }],
      },
      {
        id: 'hint',
        text: 'Headed for Duskhollow? The Redclaws post an archer on the rocks above the gate. Put her down first, or she will put you down.',
        choices: [{ text: 'Good eyes. Thank you.', next: 'end' }],
      },
    ],
  },
};
