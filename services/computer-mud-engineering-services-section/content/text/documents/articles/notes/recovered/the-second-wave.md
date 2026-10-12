---
name: the-second-wave
description: The SECOND wave of eight interlocking "Discworld-grade" systems, built ON the first wave's spine and folded into the tick and the player surface — magic (#magic: a SPELLS catalog, a mana pool, school-skill + need gates, effects delegating to #health/#conditions), faith (#faith: a DEITIES pantheon + RITUALS, worship/piety, bless/curse via #conditions), stealth (#covert: hide/detect, steal, pick as deterministic integer contests), guilds (#guilds: membership cells + titles READ off #proficiency bonus thresholds), quests (#quests: declarative objectives read OFF the log — reach/slay/deliver/gather — with coin+skill rewards), medicine (#medicine: treat/heal scaled by people.healing, infection as the 'sick' condition, wounds that fester on the tick), mortality (#mortality: die→corpse+drop loot→decay→respawn), and routines (#routines: routine:<hour> schedules, clock-driven one-hop movement). All eight reuse the first wave's shared cell model (attr:*, skill:<dotted>, condition:*, coin, located-in) and import #proficiency/#conditions/#health/#market, so they compose: magic and faith spend their OWN pools (mana/piety) but their EFFECTS are the conditions and wounds the other systems already model; guilds read proficiency bonuses for titles; quests read the world with no scripting; medicine + mortality close the health loop (fester→die→corpse→respawn); routines give the world a clock-driven rhythm. The folding: #ticking now runs tickWounds + tickRoutines in phase 1 and tickMortality in phase 4; scripts/play.mjs exposes cast/learn/spells, worship/pray/invoke, hide/sneak/steal/pick, guilds/join/title, quests/accept/complete, treat/diagnose, and a deeper score with a "calling" line. What is uniquely TAB: every effect is a fold over the append-only content-addressed EAVT log, a contested skill is ⊤, and nothing uses RNG/Date so a whole life replays byte-for-byte. Grounded in being/doing/responding/casting/scripts/cast.mjs, being/doing/responding/praying/scripts/pray.mjs, being/doing/responding/skulking/scripts/skulk.mjs, being/doing/observing/guilds/scripts/guild.mjs, being/doing/responding/questing/scripts/quest.mjs, being/doing/responding/tending/scripts/tend.mjs, being/doing/changing/ticking/mortality/scripts/mortality.mjs, being/doing/changing/ticking/routines/scripts/routine.mjs, being/doing/changing/ticking/scripts/ticking.mjs, and scripts/play.mjs.
---

# The second wave — eight more systems on the same spine

## What this builds on

[`the-deep-systems.md`](the-deep-systems.md) records the FIRST wave: six interlocking systems — proficiency (attributes + a dotted skill tree with a governing-stat bonus), arsenal, deep combat, market, the soul, and conditions, plus recipes — all folds over the SAME append-only content-addressed EAVT log, sharing one cell model so they compose into a single spine rather than six bolted-on subsystems.
That note ended on an honest "still thin": nothing in play AFFLICTED a condition, and guilds / religion / a guild-that-teaches did not exist.
The condition layer was wired end-to-end but never exercised.

This note records the SECOND wave: eight new systems.
The framing is the same stated intent — make Discworld MUD blush — but the engineering point of this wave is that **none of the eight is a new foundation.** Each reads the first wave's spine.
Each imports `#proficiency` (for a skill bonus), `#conditions` (to afflict/relieve), `#health` (to injure/heal), or `#market` (for coin), and reuses the shared cell model wholesale: `attr:*`, `skill:<dotted>`, `condition:*`, `coin`, `located-in`.
Where the first wave wired the condition layer but never fired it, this wave fires it from six directions.

## The shared cell model, reused

Each file states plainly that it adds **no new column the other systems can't already read**, and where it needs a single-valued cell of its own it builds a LOCAL functional set (substrate `FUNCTIONAL` ∪ its cells) and settles against that — the pattern the first wave's `#needing`/`#health` and `#conditions` already use, leaving the substrate untouched.
The cells the eight new systems introduce are, per the files:

- **`mana`** (functional int) and **`knows-spell:<name>`** (functional-by-prefix marker) on a caster (`#magic`).
  An unspent caster's mana DEFAULTS to `attr:int * 2`.
- **`worships`** (→ a deity name) and **`piety`** (functional int) on a devotee (`#faith`).
- **`hidden`** (concealment strength), **`sneaking`** (bool), **`locked`** (a difficulty integer) (`#covert`).
- **`guild-member:<guild>`** (functional-by-prefix flag) on a member (`#guilds`).
- **`quest:<questId>`** (status `"accepted"|"done"`, an already-substrate functional prefix) on a questee (`#quests`).
- **`dead`** (bool) and **`decay`** (rot counter) on an actor/corpse (`#mortality`).
- **`routine:<hour>`** (→ a destination area) on an NPC (`#routines`).

`#medicine` introduces NO cell of its own — it reads and writes `injury:<part>` (#health) and the `sick` `condition:` (#conditions) only.

## The eight systems

### 1. Magic — a mana pool, school gates, effects that are conditions (`#magic`)

`casting/` nests under `responding/` beside `fighting` and `crafting`: a spell is a MOVE an actor responds with.
`cast(root, caster, spell, target, t)` gates on three reads off settled state — the caster KNOWS the spell (`knows-spell:<name>`), `manaOf(caster) ≥ cost`, and `bonusOf(caster, spell.school) ≥ need` — then DEBITS mana (a fresh, lower `mana` cell; latest-t supersedes) and applies the effect.
The `SPELLS` catalog names a `magic.*` school path (`magic.evocation`, `magic.healing`, `magic.illusion`), a mana `cost`, a `need`, and an `effect` of one of four kinds, **each delegated to an EXISTING system** (the file's own words: "we add no column"): `harm` → `#health.injure`, `heal` → `#health.heal`, `afflict` → `#conditions.afflict`, `reveal` → a pure read of the target's wounds/conditions.
So `spark` scratches an arm, `befuddle` afflicts `drunk`, `shield` afflicts `blessed` on the caster, `frostbite` harms AND chains an `exhausted` affliction.
Every condition the catalog names is already in `#conditions`' catalog — the file states it invents none.

### 2. Faith — gods, devotion, ritual (`#faith`)

`praying/` nests under `responding/`.
A deity in the `DEITIES` catalog has a domain, a BLESSING condition it grants and a CURSE condition it visits — and **both are condition names drawn from `#conditions`** (Maraset blesses `blessed`, curses `afraid`), so a ritual lands through the same `afflict()` the rest of the sim reads.
`worship(id, deity)` files the functional `worships` cell; `pray(id)` raises `piety` by a step AND files a `faith.devotion` skill success (a prayer both deepens piety and TEACHES the devotion skill).
`invoke(invoker, ritual, target, t)` — the default export — gates on `pietyOf ≥ cost` AND `bonusOf(invoker, "faith.rituals") ≥ need` (devotion alone is not enough; the rite must be trained), debits piety, and applies an effect: `bless`/`curse` via `#conditions.afflict`, `heal`/`smite` via `#health`, or `augury` (a read).
A `benediction` needs no training; `lay-on-hands` and `smite` need a trained ritual hand.

### 3. Stealth — covert play as integer contests (`#covert`)

`skulking/` nests under `responding/`.
Every covert act is one fiber composed against another, and — exactly as `#fighting` resolves a strike by comparing two integers — there is NO RNG and NO Date: every outcome is `skill-bonus (+ attribute edge) ≥ resistance`.
`hide` files a `hidden` strength (`bonusOf(covert.stealth) + edge(dex)`); `detect` is a pure read (observer perception ≥ the hider's hidden); `steal` wins when the thief's sleight ≥ the victim's awareness, moving the item's `located-in` to the thief; `pick` opens when craft (`covert.locks` bonus + a lockpick-tool bonus) ≥ the lock's `locked` difficulty.
The contests read against the `covert` tree (governed by dex in `#proficiency`).

### 4. Guilds — membership cells, titles read off proficiency (`#guilds`)

`guilds/` nests under `observing/` beside `proficiency/`: a guild reading is a QUOTE of where an actor STANDS.
The `GUILDS` table gives each order a governing `skill` (a path or tree-root), a `fee` in pennies, and an ascending `titles` ladder of `{ at, title }` thresholds.
Membership IS a cell (`guild-member:<guild>`); **the title carries NO cell** — `titleOf(id, guild)` reads `bonusOf(id, guild.skill)` and walks the ladder for the highest rung the bonus has reached.
So a title is a function OF membership and skill, not a stored fact: a member rises as their governing skill accrues.
`join` debits the `fee` against the purse (`#market.coinOf`) and refuses if it can't cover.

### 5. Quests — objectives read OFF the log, no scripting (`#quests`)

`questing/` nests under `responding/`.
A quest is a TABLE entry whose objective is a tiny declarative spec CHECKED by READING the settled world — the file stresses there is **no objective scripting, no hidden counter, no callback**.
The four kinds are each a pure read: `reach` (the questee is `located-in` the area), `slay` (the target reads `alive:false` via `healthOf`), `deliver` (the item is `located-in` the recipient), `gather` (the questee carries ≥ count items bearing a `material:` cell).
`accept` files `quest:<id>="accepted"`; `complete` grants the reward only when accepted AND met — coin via a new `#market` `coin` cell, a skill via `#practicing` rows.
NPC and player share the EXACT same path; "met" is a query over the trace at the moment you ask.

### 6. Medicine — treat, heal, and wounds that fester (`#medicine`)

`tending/` nests under `responding/` beside `fighting`: where a fight files an injury, a treat LOWERS one.
It adds no column — it reads through `#health` and `#conditions` and writes back through their own morphisms.
`treat(healer, patient, part, t)` closes a wound by `clamp(BASE + floor(bonus/PER), 1, MAX)` where `bonus` is the healer's `people.healing` proficiency (a master closes more per visit; everyone can stop the bleeding) and RELIEVES one point of the `sick` condition — clean hands fight the fever.
The other half is the tick-fold `tickWounds(t)`: any actor carrying an untended wound of severity ≥ `INFECTION_THRESHOLD` (7) has its `sick` condition raised by 1 — the wound FESTERS.
A wound the healer just lowered below the threshold no longer festers; that is the break.

### 7. Mortality — death, corpses, decay, respawn (`#mortality`)

`mortality/` nests under `ticking/` because dying is a pure TICK-RULE the world applies to itself.
Without it, an actor driven to `alive:false` (a severity-10 torso wound via `healthOf`) lingers undying, holding its loot forever.
`die(id, t)` mints a content-addressed `corpse:<hash>` entity (its id derived from the dead actor + the death tick, so the same death mints the same corpse across replays), MOVES every carried item to `located-in` the corpse (loot stays with the body), and files `dead=true`.
`tickMortality(t)` — the default export — crosses every newly-dead actor's death transition and rots every standing corpse one `decay` step until `ROT_AT` (12 ticks), when its `located-in` is retracted and it leaves the room.
`respawn(id, room, t)` heals all parts, clears `dead`, and replaces the actor — the renewal a player gets.

### 8. Routines — a clock-driven daily rhythm (`#routines`)

`routines/` nests under `ticking/`: a routine is a pure TICK-RULE that reads the clock.
An NPC bears sparse `routine:<hour>` cells (object = a destination area); the schedule is CYCLIC over the 24-hour day — the potential destination is the entry for the greatest hour ≤ the current hour, wrapping to yesterday's last posting before today's first.
`tickRoutines(t, hour?)
` reads the hour (from `#timing`), and for each mover with a routine not already at its active destination does ONE deterministic BFS hop over `exit-*` toward it (frontier expanded in sorted order, so a world replays to one move).
It is the half of NPC life that is APPOINTMENT rather than appetite, the sibling of `decide.mjs`'s walk toward a needed resource.

## The new interlocks

The first wave's spine was *attributes → skill-tree bonus → combat & crafting; conditions modify the stats which modify everything.* This wave plugs into that spine at every joint:

- **Magic and faith spend their OWN pools, but their effects are the shared model.** A spell debits `mana`, a ritual debits `piety` — pools the first wave never had.
  But the EFFECT is a `#health` wound or a `#conditions` affliction the first wave already models and the tick already decays.
  This is what FIRES the condition layer the first wave left unexercised: `befuddle` makes a foe `drunk`, `shield` makes you `blessed`, a `benediction` blesses an ally — and each one ebbs on the tick that already decays conditions.
- **Guilds read proficiency bonuses for titles.** No new ranking machinery — `titleOf` is a read of `bonusOf` against the guild's governing skill, the same bonus combat and crafting read.
  Standing in a guild is the skill tree seen through one more lens.
- **Quests read the world with no scripting.** A `slay` objective reads `#health.alive`; a `deliver` reads `located-in`; a `gather` reads carried `material:` cells.
  The objective is a query over the same trace every other read folds.
- **Medicine and mortality close the health loop.** The first wave could wound but had no terminus.
  Now: a fight wounds (`#fighting`) → an untended severe wound festers into `sick` (`tickWounds`) → a vital wound drives `alive:false` → `tickMortality` turns the body into a lootable corpse that decays → a player respawns.
  Harm has an end, and medicine is the off-ramp before it.
- **Routines give the world a clock.** NPC life was appetite (chase a need) or wandering; now there is appointment, read off the same `#timing` clock the tick already turns.

The folding is literal.
`#ticking` runs `tickConditions` then `tickWounds` then `tickRoutines` in phase 1 (ambient physics), and `tickMortality` in phase 4 — so festering, the daily rhythm, and death all happen as the world acts on itself, without a player verb.
And `scripts/play.mjs` surfaces all eight: `cast`/`learn`/`spells`, `worship`/`pray`/`invoke`, `hide`/`sneak`/`steal`/ `pick`, `guilds`/`join`/`title`, `quests`/`accept`/`complete`, `treat`/`diagnose` — plus a deeper `score` with a **calling** line that shows a caster's mana, a devotee's god + piety, and any guild titles, kept off a plain fisherman's sheet.

## What is uniquely TAB (not Discworld)

The wave keeps the substrate's defining properties, stated in every file:

- **Every effect is a fold over the append-only content-addressed EAVT log.** A spell's mana debit, a ritual's piety spend, a stolen item's move, a corpse, a quest's status — all are appended cells.
  There is no game state; faith, mana, guild standing, and quest progress are each `fold(log)` read through one more lens.
  Adding a system was a new read, not a new table.
- **A contested skill is ⊤.** A taught-then-regressed skill settles to top, surfaced (not averaged away).
  `score` still flags such a skill "contested" — and guild titles, quest skill-rewards, and faith.devotion all ride the same skill cells that can hold both ways at once.
- **Nothing uses RNG or Date.** A spell's hit is a mana/bonus comparison; a covert contest is an integer comparison; a corpse id is content-addressed from (actor, death tick); a routine hop is a sorted-frontier BFS; a heal amount is arithmetic.
  So a whole life — every spell, prayer, theft, quest, treatment, death, and daily round — **replays byte-for-byte.** The second wave kept it.

## Still thin / next (honest)

- **The pools are seeded but the casters/devotees in the demo are sparse.** Mana defaults from
  `attr:int` and piety starts at 0; a player must `learn` spells and `pray` to build either. How
  many NPCs actually carry a school skill, a known spell, or a worship cell in the demo is a
  seeding question this note does not settle — read `build.mjs` for the ground truth.
- **Guild teaching is membership + a title read, not a teacher.** Joining the Watch gives a title
  that tracks your `covert`/combat bonus; it does not yet TEACH the skill. The first wave's open
  "a guild that teaches" is half-closed — the ladder exists, the instruction does not.
- **Respawn is a morphism, not yet a player loop.** `respawn` heals, clears `dead`, and replaces an
  actor, but whether the demo wires a death-then-renewal flow for `you` (versus a permanent corpse)
  is a play-surface question to confirm against `play.mjs`/`build.mjs`.
- **Quests are a small hand-authored table; routines are sparse postings.** Both are deterministic
  and read off the log, but neither is generated or balanced — they are demo-scale, hand-picked to
  exercise the path, not playtested.
</content>
</invoke>
