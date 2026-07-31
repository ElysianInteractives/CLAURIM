// Quest + dialogue content for the vertical slice. All prose is original.
// Exemplar shapes: multi-stage group quest with kill/collect/talkTo/reach
// objectives, an optional objective, conditional dialogue entries, quest
// acquisition and turn-in through dialogue, and a merchant shop hook.
//
// Dialogue voices (docs/project/IP_STYLE_GUIDE.md): Maera is a practical
// innkeep who talks in stew, ledgers, and understatement; Brandvar is a smith
// of few words who respects work, not titles; Eydris is a dry-humored hunter
// who narrates the reach like weather. All three treat adventurers as a
// familiar TRADE passing through Fenharrow: the world has many, and no one is
// addressed as a singular chosen hero (multiplayer-aware framing, D-020).

import type { DialogueDef, QuestDef } from './schema';

export const QUESTS: Record<string, QuestDef> = {
  hollow_delve: {
    id: 'hollow_delve',
    name: 'The Hollow Delve',
    stages: [
      {
        id: 'entrance',
        journal:
          'Maera Fenn is paying crews to find Hadrin, a prospector who never came back from Duskhollow Mine. Redclaw raiders hold the mine gate; she advises against going alone.',
        objectives: [
          { id: 'clear_gate', kind: 'kill', target: 'redclaw_raider', count: 2, text: 'Drive the Redclaw raiders from the mine gate' },
          { id: 'reach_mine', kind: 'reach', target: 'kaldwyn:118:338:10', count: 1, text: 'Reach the entrance of Duskhollow Mine' },
        ],
        next: 'delve',
      },
      {
        id: 'delve',
        journal:
          'The gate is clear. Somewhere in Duskhollow Mine there may be a trace of what became of Hadrin.',
        objectives: [
          { id: 'find_journal', kind: 'collect', target: 'prospectors_journal', count: 1, text: 'Find a trace of Hadrin in Duskhollow Mine' },
          { id: 'ore_sample', kind: 'collect', target: 'duskhollow_ore', count: 1, text: 'Recover a pale ore sample (optional)', optional: true },
        ],
        next: 'warden',
      },
      {
        id: 'warden',
        journal:
          "Hadrin's journal tells of a pale thing that walks the deep vault, and of picks dropped and men gone quiet. Whatever took him is still down here, and it is not weakening.",
        objectives: [
          { id: 'slay_warden', kind: 'kill', target: 'barrow_wight', count: 1, text: 'Destroy the Pale Warden' },
        ],
        next: 'return',
      },
      {
        id: 'return',
        journal:
          'The Pale Warden is destroyed. Maera keeps her ledger honest; she will want the whole account.',
        objectives: [
          { id: 'tell_maera', kind: 'talkTo', target: 'maera', count: 1, text: 'Return to Maera Fenn' },
        ],
        next: 'done',
      },
    ],
    reward: {
      gold: 150,
      items: [{ itemId: 'healing_draught', count: 3 }],
      xp: 200,
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
        text: "Stew's on, coin's fair, and the fire doesn't care where you're from. You have the look of another blade come north for work. Good. Work is the one thing Fenharrow has too much of.",
        choices: [
          { text: 'What kind of work?', next: 'offer' },
          { text: 'Let me see your goods.', actions: [{ kind: 'openShop' }], next: 'end' },
          { text: 'Just the fire, thanks.', next: 'end' },
        ],
      },
      {
        id: 'offer',
        text: "Hadrin. A prospector, stubborn as a mule in mud. Swore Duskhollow held pale ore worth a season's trade. Nine days gone, and now Redclaw banners hang at the gate he walked through. I'm paying any crew that finds him, and I do mean crew. The last one who went up alone came back as a rumor.",
        choices: [
          { text: "We'll take the job.", actions: [{ kind: 'startQuest', questId: 'hollow_delve' }], next: 'accepted' },
          { text: 'Not our trouble.', next: 'end' },
        ],
      },
      {
        id: 'accepted',
        text: "Northeast, past the last bend of the road. Mind the raiders; they don't bargain, and the archer on the rocks earns her keep. Come back whole. I hate wasted stew.",
        choices: [{ text: 'We will.', next: 'end' }],
      },
      {
        id: 'progress',
        text: "Still nothing of Hadrin. Other crews have poked at the gate and thought better of it. If yours gets past the Redclaws, watch the deep vault; miners never liked that end of the tunnel even before all this.",
        choices: [
          { text: 'Still searching.', next: 'end' },
          { text: 'Let me see your goods.', actions: [{ kind: 'openShop' }], next: 'end' },
        ],
      },
      {
        id: 'turnin',
        text: 'Back, and standing. Your face does half the telling. Give me the rest for the ledger.',
        choices: [
          { text: 'Hadrin is dead. The thing that killed him is destroyed.', next: 'reward' },
        ],
      },
      {
        id: 'reward',
        text: "Then he rests, and the mine is clean, and I can stop lying to his sister in my letters. Take the coin; you and yours earned it. Fenharrow keeps accounts, and it remembers its friends.",
        choices: [{ text: 'Thank you, Maera.', next: 'end' }],
      },
      {
        id: 'after',
        text: 'The Hearth is yours whenever you pass, friends of Fenharrow. First bowl is on the house. The second goes in the ledger.',
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
        text: "Mind the sparks. Brandvar Hale. If you're another of Maera's hired blades, get your edges seen to before you walk north. Steel doesn't care how brave you are.",
        choices: [
          { text: 'Any advice for a fighter?', next: 'advice' },
          { text: 'What do you think of Fenharrow?', next: 'town' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
      {
        id: 'advice',
        text: "Shield up, feet under you, and when a big one winds up a swing you can see coming, that's your window; hit it hard enough and you'll spoil the blow. Fighting beside others? Pick your targets so you're not all hammering one nail while three more work loose.",
        choices: [{ text: 'Sound counsel.', next: 'end' }],
      },
      {
        id: 'town',
        text: "Timber, ore, and stubbornness; that's the whole town. My mother helped raise the palisade. I'd rather sharpen plows than swords, but the road keeps sending me swords.",
        choices: [{ text: 'May it send you plows again.', next: 'end' }],
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
        text: "Eydris. I hunt the reach and sell what it gives up. Wolves are bold by the river bend this season, so keep an arrow nocked and a friend in earshot. The reach doesn't eat careful people. Often.",
        choices: [{ text: 'Noted. Thanks.', next: 'end' }],
      },
      {
        id: 'hint',
        text: "Duskhollow, is it? Then a free scrap of scouting: the Redclaws keep an archer on the rocks above the gate and a big brute they're all scared of by the fire. Put the archer down first or she'll pick your crew apart while the brute keeps you busy.",
        choices: [{ text: 'Good eyes. Thank you.', next: 'end' }],
      },
    ],
  },
};
