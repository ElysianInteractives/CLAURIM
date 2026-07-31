# IP style guide

Claurim is a clean-room northern-fantasy MMO. The experience may rhyme with
famous inspirations; the EXPRESSION must be ours.

## Hard rules
1. No Bethesda (or any third-party) proper nouns, dialogue lines, book/lore
   passages, quest text, maps, character biographies, audio, or assets.
2. No near-copies: one-letter substitutions, pluralizations, reordered
   syllables, near-identical phonetics, direct translations of proper nouns,
   existing dialogue with nouns swapped, or trivially edited catchphrases.
3. Mechanics and genre conventions (skill trees, shouts-as-category,
   guilds, bounty systems) are fair game as CONCEPTS; implement them with
   original names, numbers, and text.
4. Every external asset (if any ever ships) gets a THIRD_PARTY_NOTICES.md
   entry with source, author, license, date, and modifications.

## Voice rules for dialogue
- Each named NPC has a voice sheet: livelihood, verbal habits, priorities,
  relationship to the settlement, one opinion about the wider world.
- MMO-aware framing: adventurers are a familiar TRADE, plural by default
  ("another blade come north", "you and yours"). Never address the player
  as a singular chosen one unless a future narrative system explicitly
  frames it.
- No placeholder-ese ("Greetings, traveler! I have a task for you").
  Characters talk about stew, ledgers, sparks, and weather - their lives -
  before they talk about the player's errand.

## Review gates
- Automated: scripts/check_ip.ts scans content prose for a maintained list
  of protected proper nouns and famous-phrase fragments (build + gate).
- Human checklist for new dialogue/lore (PR description):
  [ ] no protected names/phrases  [ ] voice sheet followed
  [ ] plural-adventurer framing   [ ] nod-not-copy check (NAMING_GUIDE)
  [ ] reads naturally to someone who missed the reference
