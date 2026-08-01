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
  bitter_root: {
    id: 'bitter_root',
    name: 'A Bitter Root',
    stages: [
      {
        id: 'trail',
        journal:
          'Tamsin Reed says briarboars have begun climbing from Gloamroot Hollow and tearing Thornmere\'s root cellars apart. Corren marked the den beneath the south road.',
        objectives: [
          { id: 'find_hollow', kind: 'reach', target: 'kaldwyn:-10:-105:12', count: 1, text: 'Find the entrance to Gloamroot Hollow' },
        ],
        next: 'sounder',
      },
      {
        id: 'sounder',
        journal:
          'Gloamroot opens beneath the road. The sounder must be culled before its matriarch teaches the next litter to raid Thornmere.',
        objectives: [
          { id: 'cull_boars', kind: 'kill', target: 'briarboar', count: 4, text: 'Cull the Gloamroot briarboars' },
          { id: 'slay_matriarch', kind: 'kill', target: 'briarboar_matriarch', count: 1, text: 'Defeat the Gloamroot matriarch' },
        ],
        next: 'return',
      },
      {
        id: 'return',
        journal:
          'The Gloamroot sounder is broken. Tamsin will want to know Thornmere can reopen its root cellars.',
        objectives: [
          { id: 'tell_tamsin', kind: 'talkTo', target: 'tamsin', count: 1, text: 'Return to Tamsin Reed' },
        ],
        next: 'done',
      },
    ],
    reward: {
      gold: 120,
      items: [{ itemId: 'healing_draught', count: 2 }],
      xp: 175,
    },
  },
  stone_toll: {
    id: 'stone_toll',
    name: 'The Stone Toll',
    stages: [
      {
        id: 'listen',
        journal:
          'Vael Orin heard the Weeping Stones ring before dawn, though no wind crossed Thornmere. He asked for careful eyes at the old basin northeast of Fenharrow.',
        objectives: [
          { id: 'reach_stones', kind: 'reach', target: 'kaldwyn:93:274:10', count: 1, text: 'Investigate the Weeping Stones' },
        ],
        next: 'clear',
      },
      {
        id: 'clear',
        journal:
          'Fresh tusk marks score the offering basin. Briarboars are worrying the buried stones and scattering every gift left there.',
        objectives: [
          { id: 'clear_boars', kind: 'kill', target: 'briarboar', count: 2, text: 'Drive the briarboars from the Weeping Stones' },
        ],
        next: 'return',
      },
      {
        id: 'return',
        journal:
          'The Weeping Stones are quiet again. Vael should hear what truly rang among them.',
        objectives: [
          { id: 'tell_vael', kind: 'talkTo', target: 'vael', count: 1, text: 'Return to Vael Orin' },
        ],
        next: 'done',
      },
    ],
    reward: {
      gold: 85,
      items: [{ itemId: 'stamina_tonic', count: 2 }],
      xp: 125,
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

  tamsin_dialogue: {
    id: 'tamsin_dialogue',
    entries: [
      { conditions: [{ kind: 'questCompleted', questId: 'bitter_root' }], node: 'after' },
      { conditions: [{ kind: 'questAtStage', questId: 'bitter_root', stageId: 'return' }], node: 'turnin' },
      { conditions: [{ kind: 'questAtStage', questId: 'bitter_root', stageId: 'trail' }], node: 'progress' },
      { conditions: [{ kind: 'questAtStage', questId: 'bitter_root', stageId: 'sounder' }], node: 'progress' },
      { conditions: [{ kind: 'questNotStarted', questId: 'bitter_root' }], node: 'greet' },
    ],
    nodes: [
      {
        id: 'greet',
        text: "Tamsin Reed. I keep Thornmere's stores counted and its roofs patched, which lately means counting claw marks and patching cellar doors. If you're looking for work, the south road has sent us some.",
        choices: [
          { text: 'What came up the south road?', next: 'offer' },
          { text: 'Tell me about Thornmere.', next: 'crossing' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
      {
        id: 'crossing',
        text: "A cart stop that learned to put down roots. We trade timber, oats, and dry beds between Fenharrow and the southern farms. Small place, but a road survives by its small places.",
        choices: [
          { text: 'And the trouble?', next: 'offer' },
          { text: 'Safe roads.', next: 'end' },
        ],
      },
      {
        id: 'offer',
        text: "Briarboars. Not the lean wanderers we sometimes see—the whole sounder is climbing out of Gloamroot and breaking into our root cellars. Corren found the den. We need a crew to break the matriarch before hunger teaches them our doors.",
        choices: [
          { text: "We'll clear Gloamroot.", actions: [{ kind: 'startQuest', questId: 'bitter_root' }], next: 'accepted' },
          { text: 'Find another crew.', next: 'end' },
        ],
      },
      {
        id: 'accepted',
        text: "Follow the road north out of Thornmere, then watch the west bank for roots around a dark arch. Corren says the matriarch nests at the deepest wall. Come back with fewer tusks behind you than ahead.",
        choices: [{ text: 'Understood.', next: 'end' }],
      },
      {
        id: 'progress',
        text: "The cellars are barred and the winter roots are still inside them. Gloamroot lies north along the road, under the west bank. Don't chase strays and forget the matriarch.",
        choices: [{ text: "We'll finish it.", next: 'end' }],
      },
      {
        id: 'turnin',
        text: 'You came back without the hollow at your heels. Tell me the sounder is broken.',
        choices: [{ text: 'The matriarch is dead. Thornmere can open its cellars.', next: 'reward' }],
      },
      {
        id: 'reward',
        text: "Then we eat what we stored instead of what the boars leave us. Here—road coin and two draughts from the lodge chest. Thornmere remembers crews that keep its doors standing.",
        choices: [{ text: 'Keep the crossing well.', next: 'end' }],
      },
      {
        id: 'after',
        text: "The south cellar is open again. Corren claims the quiet proves his tracking; I claim the repaired door proves mine. Either way, you've a bed here when the road turns foul.",
        choices: [
          { text: 'How is Thornmere?', next: 'crossing' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
    ],
  },

  corren_dialogue: {
    id: 'corren_dialogue',
    entries: [
      { conditions: [{ kind: 'questCompleted', questId: 'bitter_root' }], node: 'after' },
      { conditions: [{ kind: 'questAtStage', questId: 'bitter_root', stageId: 'trail' }], node: 'hint' },
      { conditions: [{ kind: 'questAtStage', questId: 'bitter_root', stageId: 'sounder' }], node: 'hint' },
      { node: 'greet' },
    ],
    nodes: [
      {
        id: 'greet',
        text: "Corren Pike. I walk the verge and count tracks before they become problems. Harts on the ridge are shy but harmless. If you see a low shape with shoulders like a stump, give the tusks room.",
        choices: [
          { text: 'What should I know about briarboars?', next: 'boars' },
          { text: 'The harts are safe?', next: 'harts' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
      {
        id: 'boars',
        text: "They lower the head before a charge. Step aside, not back, or the ground does their work for them. The big Gloamroot sow has learned to turn late, so don't crowd your crew into one line.",
        choices: [{ text: 'Useful warning.', next: 'end' }],
      },
      {
        id: 'harts',
        text: "Safe if left uncornered. They follow the sweet grass below the trees and move on when voices get close. Seeing them near Thornmere usually means the wolves are hunting elsewhere.",
        choices: [{ text: "We'll leave them their grass.", next: 'end' }],
      },
      {
        id: 'hint',
        text: "Tamsin sent you to Gloamroot? The arch is under the west bank north of here. Four smaller tracks go in and out. The matriarch's print stays deep, near a root wall wide enough to hide her charge.",
        choices: [{ text: 'We will watch the turn.', next: 'end' }],
      },
      {
        id: 'after',
        text: "No fresh track has crossed the south ditch since your crew came back. The harts returned before sunrise. That's as close as the reach comes to saying thank you.",
        choices: [{ text: 'Quiet roads.', next: 'end' }],
      },
    ],
  },

  vael_dialogue: {
    id: 'vael_dialogue',
    entries: [
      { conditions: [{ kind: 'questCompleted', questId: 'stone_toll' }], node: 'after' },
      { conditions: [{ kind: 'questAtStage', questId: 'stone_toll', stageId: 'return' }], node: 'turnin' },
      { conditions: [{ kind: 'questAtStage', questId: 'stone_toll', stageId: 'listen' }], node: 'progress' },
      { conditions: [{ kind: 'questAtStage', questId: 'stone_toll', stageId: 'clear' }], node: 'progress' },
      { conditions: [{ kind: 'questNotStarted', questId: 'stone_toll' }], node: 'greet' },
    ],
    nodes: [
      {
        id: 'greet',
        text: "Vael Orin. I mend harness, tend the stable, and wake when old stones ring without a bell. That last duty found me before dawn today.",
        choices: [
          { text: 'What rang?', next: 'offer' },
          { text: 'Do the stones often sound?', next: 'history' },
          { text: 'Farewell.', next: 'end' },
        ],
      },
      {
        id: 'history',
        text: "Only in hard frost, when the buried edges shift. This morning was mild and still. My grandmother called them the Weeping Stones because rain sings down their cracks. She never heard them in dry air.",
        choices: [
          { text: 'Where are they?', next: 'offer' },
          { text: 'An uneasy sound.', next: 'end' },
        ],
      },
      {
        id: 'offer',
        text: "Northeast of Fenharrow, beside the old road. There is a shallow basin between three stones. Go with careful eyes, not a pilgrim's story. I need to know what moved them, and whether it is coming closer.",
        choices: [
          { text: "We'll investigate.", actions: [{ kind: 'startQuest', questId: 'stone_toll' }], next: 'accepted' },
          { text: 'Not today.', next: 'end' },
        ],
      },
      {
        id: 'accepted',
        text: "Take the north road beyond Fenharrow and watch the eastern rise. Three dark crowns against the sky. If you find an offering, leave it where it lies until you know what shares the place.",
        choices: [{ text: 'We will look, not guess.', next: 'end' }],
      },
      {
        id: 'progress',
        text: "The Weeping Stones stand northeast of Fenharrow. Listen once before you draw steel. A frightened animal and an old danger leave different silences.",
        choices: [{ text: 'We will return with facts.', next: 'end' }],
      },
      {
        id: 'turnin',
        text: "You heard them, then. Was it something under the stones?",
        choices: [{ text: 'Briarboars scored the basin. We drove them off.', next: 'reward' }],
      },
      {
        id: 'reward',
        text: "Tusks on stone. Good. That is a danger with tracks and blood, not a tale that grows each time it is told. Take this coin and tonic; truth should pay at least as well as rumor.",
        choices: [{ text: 'Keep listening, Vael.', next: 'end' }],
      },
      {
        id: 'after',
        text: "The stones have kept quiet. I still wake before dawn, but now I blame the stable roof. That is a smaller mystery and a cheaper one.",
        choices: [{ text: 'May it stay small.', next: 'end' }],
      },
    ],
  },
};
