---
title: Ritual and Atmosphere
description: "Audience: builders and reviewers implementing game-start/end ceremony, the quiet room, sound design, and board materiality themes for the weiqi platform."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  gomagic2026nigiri:
    authors:
      - GoMagic2026Nigiri
    title: "GoMagic, Nigiri in Go"
  britgo2026etiquette1:
    authors:
      - BritGo2026Etiquette1
    title: "British Go Association, Go Etiquette"
  britgo2026etiquette2:
    authors:
      - BritGo2026Etiquette2
    title: "British Go Association, Etiquette, Attitudes & Advice"
  newworld2026goboard:
    authors:
      - NewWorldEncyclopedia2026Go
    title: "New World Encyclopedia, Go (board game)"
  mastersofgames2026stones:
    authors:
      - MastersOfGames2026Stones
    title: "Masters of Games, Clamshell & Slate Go Stones"
  mineralmatters2026stones:
    authors:
      - MineralMatters2026Stones
    title: "Mineral Matters, Japanese Go Stones"
cites:
  - gomagic2026nigiri
  - britgo2026etiquette1
  - britgo2026etiquette2
  - newworld2026goboard
  - mastersofgames2026stones
  - mineralmatters2026stones
---

Audience: builders and reviewers implementing game-start/end ceremony, the quiet room, sound design, and board materiality themes for the weiqi platform.

This document specifies Pillar 5 — "ritual is designed, not skipped" — for four concrete surfaces: the nigiri, the bow, the quiet room, and sound/materiality. It is bound by Pillar 4 (calm by construction) at every point where ceremony could curdle into friction, and by [The Magic Circle and Its Critics](../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/social-theory-science-services-section/services/ludics-science-services-section/services/game-ludics-services-section/content/text/documents/articles/notes/the-magic-circle-and-its-critics.md) for why ritual is worth building at all.

## Why ritual, precisely (not decoratively)

The magic-circle lesson's central move, after surveying gambling, professional play, and Geertz's deep play, is to downgrade the circle from a wall to a **tendency** — a boundary that is negotiated, partial, and strongest when something marks it deliberately. Huizinga's own examples of the circle are ritual acts: "the arena, the card table, the stage, the tennis court." The circle is not ambient; someone draws it.

Go's own culture already contains the drawing-tools: nigiri decides who plays which color, the bow at start and end marks the boundary's opening and closing, and a quiet, uncluttered board is the default expectation of a serious game, not a special mode. None of this is ours to invent. Our job is narrower and more binding: **build the tools that let a digital game draw the same circle a physical board draws**, without turning them into decoration a player must click through to reach the game (that would violate Pillar 1) or ceremony that nags a player who has already told us she doesn't want it (that would violate Pillar 4).

The consent mechanism that runs under every ritual in this document is one schema, defined once here and referenced everywhere below:

```
RitualPreference {
  nigiri:     "ask" | "skip"   // default "ask"
  bow:        "ask" | "skip"   // default "ask" — "ask" means "show it", not "prompt"
  handicapConfirm: "ask" | "skip"  // default "ask"
}
```

"Skip" is not a per-game click-through — it is a standing preference, set once from a "Don't show this again" control attached to the ritual itself, changeable later from a settings screen, never re-prompted. Phase 1 (no accounts) stores `RitualPreference` in `localStorage`, keyed by device; Phase 2's account system promotes it to a D1 user-preference row so the choice follows the player, not the browser (see Roadmap obligations). This is what "consent, not ceremony-spam" means operationally: the platform asks once, honors the answer indefinitely, and only a player's own settings screen — never an app-initiated re-prompt — can change it back.

## The nigiri

Nigiri ("grasp") is the customary procedure for assigning colors in a game between players of comparable, undetermined strength: one player grasps a handful of white stones with the count concealed, the other calls odd or even, and the parity decides colors [@gomagic2026nigiri].

**When it fires.** Nigiri is the color-assignment ritual for exactly one case: an even game (no handicap) between two players where the platform has no rank-derived reason to assign colors. It does **not** fire when color is already determined by data the platform holds:

| Situation | Color decision | Nigiri? |
|---|---|---|
| No rating data for either player, casual even game | Undetermined until the players decide | Yes |
| Rank gap of exactly one grade (per [Handicap Placement and Komi Values](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/handicap-placement-and-komi-values.md)) | Weaker player takes Black, no komi, no stones | No — see handicap variant below |
| Rank gap ≥ 2 grades | Handicap stones placed, weaker player is Black by convention | No — see handicap variant below |
| Rematch with "swap colors" agreed | Colors swap automatically | No |

The rule is general: **nigiri exists to resolve genuine uncertainty, not to perform a decision the platform has already made.** Running it anyway (a common failure mode: "always show the ritual, it's charming") would violate Pillar 1's "do first, name after" by inserting ceremony in front of a decision that isn't live, and would read as ceremony-spam under Pillar 4.

**Interaction spec (even game).** The naive digital nigiri — "click a button, get a random result" — is unauditable: a player has no way to know the server didn't pick the outcome after seeing the guess. The spec instead uses a commit–reveal sequence, which is the online equivalent of the concealed handful: the outcome is fixed before the guess, but hidden until after it.

1. On game creation, the server independently generates a secret 32-byte seed and derives a stone count `n` from it (`n = 1 + (seed mod 2)` is sufficient — only the parity matters). It computes `commitment = SHA-256(seed || gameId)` and sends `commitment` to both clients. Neither client can derive `seed` or `n` from `commitment`.
2. The UI shows a single closed-hand glyph (the "holder") and a prompt to the **other** player: "Call it — odd or even?" The holder role has no decision to make; it exists so the visual matches the physical ritual, not because either human is choosing the count.
3. The calling player submits `guess ∈ {odd, even}`.
4. The server reveals `seed` and `n`. Both clients independently recompute `SHA-256(seed || gameId)` and check it equals the `commitment` received in step 1 — this is the auditable part; a builder who skips this check has shipped a nigiri no player can trust.
5. `guess === parity(n)` → the calling player takes Black. Otherwise White. Colors and the revealed count render together so both players see the same evidence.

**Skippable.** A "Don't ask me this again" control sits on the nigiri screen itself. Skipping sets `RitualPreference.nigiri = "skip"` and, going forward, colors are assigned by the same commit–reveal RNG but resolved silently (no screen, no guess) — fairness doesn't depend on the ceremony being watched, only on the commit–reveal happening. **Refusal condition:** a build that skips the ritual screen but *also* drops the commit–reveal audit trail has shipped a coin flip, not a nigiri-with-consent; the audit step is not part of what gets skipped.

**Handicap-game variant.** When the color decision is rank-determined (either row of the table above with a handicap), nigiri does not run at all. It is replaced by a **handicap confirmation** screen, driven directly by the tables in [Handicap Placement and Komi Values](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/handicap-placement-and-komi-values.md):

- Stone count = rank gap in grades (one stone per full grade, kyu or dan, per that document's rank-gap rule of thumb).
- Placement = the fixed hoshi order table (2 stones → two diagonal corners, up through 9 stones → all nine hoshi; tengen appears only at 5, 7, and 9 stones), unless the active ruleset is Chinese, Ing (SST), or New Zealand, in which case the confirmation screen says "free placement — Black may place anywhere" instead of pre-drawing points.
- Komi = the ruleset's handicap komi, never even-game komi: 0.5 nominal under Japanese/Ing/New Zealand rules; 0.5 plus *n*/2 to White under Chinese rules; 0.5 plus *n*−1 to White under AGA area counting. **Test:** a handicap-game confirmation screen that shows a komi value in the 6–8.5 range (even-game range) has a bug — that range belongs only to the no-handicap table.
- One-grade gap: the confirmation screen shows zero stones and 0 komi, with copy that names what's happening ("even placement, Black moves first, no komi") rather than silently skipping to the board — Pillar 1 again: the player enacted a rank-based decision and deserves the name for it before it fires.

This confirmation screen is itself skippable under `RitualPreference.handicapConfirm`, same consent mechanism as nigiri.

## The bow

The bow marks the boundary's opening and closing the way the nigiri marks the boundary's first decision. Go etiquette pairs the opening bow with *onegaishimasu* ("please treat me well" / "let's have a good game") and expects a bow (sometimes paired with *arigatou gozaimashita*, "thank you for what you did") at the close [@britgo2026etiquette1; @britgo2026etiquette2].

**Visual spec.** Two small stone-colored discs (or, where avatars exist, the players' avatar glyphs) positioned at their board edge, inclining toward the board's center by 15° and returning to level — the same magnitude cited for a casual Japanese bow, not the deeper 30–45° reserved for formal apology. Total animation, incline plus return, is capped at **800ms**; a build that needs longer to read as a bow should use a slower incline curve within that budget, not extend the budget. `prefers-reduced-motion` replaces the incline entirely with a 150ms opacity cross-fade between "level" and "bowed" glyphs — no rotation is computed or rendered.

**Copy spec.**

| Moment | Primary line | Secondary line (smaller, below) |
|---|---|---|
| Game start | "Onegaishimasu" | "Please enjoy the game." |
| Game end (any cause: resignation, scored win, agreed draw where the ruleset allows one) | "Arigatou gozaimashita" | "Thank you for the game." |

Both lines render together, romanized Japanese first — this is the same pairing pattern the platform already uses for glossary terms (name after doing), applied to courtesy phrases instead of rules vocabulary. No translation picker, no localization branching in Phase 1: the phrase is the ritual, not a string to be replaced by an equivalent in the viewer's language.

**Skippable, default-on.** A small "skip bows" toggle sits in the same corner as the nigiri skip control. `RitualPreference.bow = "skip"` removes both the start and end bow entirely — no shortened version, no silent glyph-only variant. A ritual either happens with its meaning intact or does not happen; there is no "ritual, but faster" tier, because a faster tier is exactly the kind of ceremony-as-friction Pillar 4 forbids building around.

**Refusal condition.** The bow must never block input. The board is interactive (stones can be placed, though the first move typically hasn't happened yet) from the instant the start bow begins rendering — it is a 800ms-capped overlay animation, never a modal gate. A build that disables the board until the bow animation finishes has turned a ritual into a loading screen, which is the opposite of what it's for.

## The quiet room

The quiet room is the platform's most literal enactment of "the magic circle drawn deliberately" (Pillar 5): a mode that strips every interface element that is not the game itself.

**What remains, exactly — nothing else is permitted:**

| Element | Present in quiet room? |
|---|---|
| The board (stones, grid, star points, coordinate labels if the player has coordinates on) | Yes |
| The clock, if the game is timed | Yes |
| Screen-reader move announcements and other assistive-technology output | Yes — an information channel, not chrome; quiet room reduces visual clutter, not accessibility |
| Player names, avatars, ratings | No |
| Captured-stone count | No |
| Chat, move list, glossary hover-cards | No |
| Site navigation, logo, any chrome outside the board and clock | No |
| The bow and nigiri rituals themselves | Unchanged — they render on/around the board, which is exactly the surface quiet room preserves, not the chrome it strips |

The table is exhaustive by design: "the board, clock if timed, nothing else" is a refusal condition, not a suggestion. A reviewer checking a quiet-room implementation should be able to screenshot it and account for every visible pixel against this table; anything unaccounted for is a bug.

**Entry and exit.** A single toggle, available from the in-game control strip (which itself disappears once quiet room is entered — see below) and bound to a keyboard shortcut (`q`, mnemonic and short, matching the "keyboard: full coordinate navigation" accessibility commitment in the platform plan's interface section). Entering hides everything the table marks "No," with a 150ms opacity fade (not a layout reflow, so the board does not resize or jump). Exiting is the same control, same fade, reversed. Because the control strip itself is chrome, quiet room's own exit affordance is the one piece of chrome that survives as a minimal, low-contrast corner tab — labeled, not iconography-only, so it is discoverable without a hover state.

**Reduced-motion interaction.** Under `prefers-reduced-motion`, the 150ms fade is replaced by an instant, one-frame swap — chrome is present one frame and absent the next, no cross-fade computed. This is consistent with the bow's reduced-motion behavior above: the rule for this whole document is *reduced motion removes the animation, never the ritual or the mode itself.*

**Not a ranked-play requirement.** Quiet room is available in every mode — tutorial, casual, teaching, ranked once Phase 3 ships rated play — because the circle it draws is about attention, not stakes. Pillar 4's test applies directly: quiet room exists because some players concentrate better without chrome, not because hiding the scoreboard makes anyone engage longer.

## Sound design

**Stone placement — material-dependent family.** Each materiality theme (below) declares one placement-sound sample set, selected by the same `data-material` attribute that drives the theme's visual tokens, so a builder never has to keep a sound choice and a color choice in sync by hand. Placement sound plays once per accepted move, timed to the stone's visual settle (the same frame the stone stops any placement animation), never before the move is confirmed legal.

**Capture — one sound family, scaled by size.** Capture is a lift-and-sweep sound, timbrally distinct from placement (placement is a single attack-decay "tap"; capture is a longer, slightly descending sweep, 200–350ms depending on stones-removed count, capped so a large capture doesn't become a wall of noise). One capture sound plays per move regardless of how many groups die in that move (matching the kernel's own aggregation — `events.mjs` fires one `capture` event per move even when multiple groups die, with `groupsCaptured` in its detail; the sound layer should read that field for its scaling, not recompute a stone count independently).

**Byo-yomi — calm, not alarm.** This is the one place in the sound spec where an existing convention (chess-clock style accelerating beeps) is explicitly rejected, and the rejection is a refusal condition:

- One soft, low-attack chime per byo-yomi **period boundary** (i.e., when a period is used up and the count resets), not per second and not per remaining-seconds threshold.
- No pitch rise, no tempo increase, and no volume increase as periods deplete. The chime at the last period sounds identical to the chime at the first.
- No sound at all inside a period's countdown — the visible countdown number is the time-pressure signal; sound is reserved for the boundary event only, which is itself a `semantic` fact (a period elapsed) worth marking the same way capture or ko-resolved are marked, not a UI convenience.

**Justification, briefly:** Pillar 4 forbids manufactured urgency, and an accelerating countdown beep is manufactured urgency's most literal audio form — it is the same design pattern as a loot-box reveal jingle, calibrated to raise heart rate rather than convey information the player doesn't already have (the clock is on screen). A single calm boundary chime still tells a player "a period just elapsed," which is real information delivered once, cleanly, at the moment it becomes true — exactly Pillar 2's standard for feedback.

**Atari — reconsidered, and given a sound.** The brief's starting assumption — no atari sound, because sound should never carry information a sighted player couldn't get by looking — turns out not to be the live question. Atari is **already fully visible, public information**: a group at one liberty is a fact anyone looking at the board can verify by counting, exactly as anyone can verify a capture by looking. A sound cue for it leaks nothing; there is no hidden state to protect. The real question is Pillar 4's, not a fairness one: does an atari sound manufacture urgency the way a byo-yomi alarm would?

The answer is a **default that depends on mode**, because the risk is mode-dependent:

| Mode | Atari sound default | Why |
|---|---|---|
| Capture Go / tutorial / first 9×9 games | On | Atari is the concept the whole mode teaches (Pillar 3's onboarding ladder); a sound layered on the placement tap of the stone that *entered* atari (same sample, pitched up ~15%, no separate alarm sample, no volume boost) reinforces "this just happened" the instant it happens — Pillar 2's warm-feedback standard, delivered audibly for a player still learning to see it visually. |
| Casual, teaching, ranked play among players who have already demonstrated the concept | Off | At this level atari is read instantly by sight; a recurring cue becomes a "tell" that interrupts flow rather than teaching anything, and a sound that fires dozens of times a game starts to feel exactly like the manufactured-urgency pattern Pillar 4 forbids, even though no single instance is alarming. |

Both defaults are one toggle, changeable at any time, remembered the same way `RitualPreference` is remembered — this is a sound preference, not a ritual, so it lives alongside `RitualPreference` in the same storage rather than inventing a second preference object. **Refusal condition:** the atari cue must reuse the placement sample with a pitch shift only — a dedicated alarm/ping sample for atari is exactly the pattern byo-yomi's spec rejects, and using one here would contradict this document's own reasoning two sections up.

## Materiality themes

Every theme is a single `data-material` value on the board's host element. It drives both the CSS custom properties `board.mjs` already reads — [`--board-bg`, `--board-line`, `--stone-black`, `--stone-white`, `--board-accent`](../../../../../apps/weiqi-learn/public/js/ui/board.mjs) — and the sound family from the section above. Two new tokens are added here, used only by themes that need a specular highlight on the stones; themes that don't set them simply render flat, which is the `board.mjs` fallback behavior already documented for every token.

| Token | Purpose | Falls back to |
|---|---|---|
| `--stone-black-highlight` | Specular gradient stop for glossy stone materials | transparent (flat fill only) |
| `--stone-white-highlight` | Specular gradient stop for glossy stone materials | transparent (flat fill only) |

| Theme (`data-material`) | `--board-bg` | `--board-line` | `--stone-black` | `--stone-white` | Highlights | Sound family |
|---|---|---|---|---|---|---|
| `kaya` (default) | `#dfb676` (warm kaya gold) | `#2b1c0f` | `#161616` matte | `#f5f3ee` warm off-white | none (matte) | wood-clack — a single warm, low-mid "tap"; the traditional kaya goban is prized specifically for this tone [@newworld2026goboard] |
| `slate-shell` | `#dfb676` (board wood is independent of stone material — kaya remains standard even with slate/shell stones) | `#2b1c0f` | `#0c0c0c` with `--stone-black-highlight: rgba(255,255,255,0.12)` | `#faf6ec` with `--stone-white-highlight: rgba(255,255,255,0.35)` | subtle, on both | slate-click — black (Nachi slate) and white (clamshell) stones have historically distinct densities and give an audibly different click between colors, which the two-sample pair reproduces rather than sharing one sample for both colors [@mastersofgames2026stones; @mineralmatters2026stones] |
| `glass` | `#e8e6e2` (light, neutral — glass sets are traditionally played on lighter surfaces than kaya) | `#4a4a48` | `#141414` with alpha `0.92` | `#ffffff` with alpha `0.88` | strong, on both | glass-clink — a brighter, higher-pitched, shorter-decay tap |
| `minimal-flat` | `#f4f4f2` (light neutral) or `#1c1c1c` (dark neutral, theme-paired) | `#8a8a86` | `#161616` flat | `#f5f3ee` flat | none | soft-tap, quiet by default — this theme is the deliberate low-stimulus option, paired with quiet room and reduced-motion players rather than styled to compete with the other three |

`kaya` remains the fallback whenever `data-material` is unset — this matches `board.mjs`'s already-documented default values exactly, so a page that never sets the attribute renders `kaya` without any code change.

## Seasonal restraint

Per Pillar 4's forbids list ("gamification currencies that displace Go's own forms of standing," read together with "no expiring rewards"), the materiality themes above are the **entire** cosmetic surface the platform ships, permanently:

- All four themes are available to every account (and, in Phase 1, every anonymous device) from the moment they ship. No unlock condition, no rank gate, no purchase, no login-streak requirement.
- No seasonal or event reskins are ever added — no holiday board, no anniversary stone set, no limited-time anything. A theme, once shipped, stays available indefinitely; a theme is never retired to create scarcity either.
- No cosmetic monetization. The platform plan reserves Stripe for premium *features* (deep reviews, courses) explicitly out of scope until there are users at all — materiality is not a feature in that sense, and Pillar 4's test ("would we still build this if we couldn't measure engagement") answers itself: these themes exist because kaya, slate-and-shell, and glass are the real materials Go has been played on, and minimal-flat exists for players who want none of that texture. None of the four cases is about retention.
- **Test for any future theme proposal:** if the pitch for a new theme mentions a date, a streak, a currency, or a purchase, it fails Pillar 4 before its color palette is even reviewed.

## Worked example: a casual 9×9 game, one returning player, one new

Player A (returning, `RitualPreference.nigiri = "skip"`, `RitualPreference.bow = "ask"`, atari sound off from a prior ranked-adjacent session) challenges Player B (new device, all defaults, `RitualPreference` absent → treated as all-"ask").

1. No rank data exists for either player (B is new), and no handicap is requested → nigiri is the correct ritual per the table above.
2. Because A has `nigiri: "skip"`, A's client resolves the commit–reveal silently and shows no nigiri screen. B's client, with `nigiri: "ask"`, still renders the full nigiri screen — **rituals are decided per player, not per game**; the commit–reveal itself only needs to run once, server-side, and both clients receive the same audited result regardless of which of them watched it happen.
3. Both clients render the start bow (A has `bow: "ask"`, so A sees it too, despite skipping nigiri — these are independent toggles). 800ms cap observed; the board accepts input the instant the overlay begins.
4. Mid-game, Black gives White's corner group atari. B's client plays the pitched-up placement echo (capture-go-shaped default is not literally active here since this is a full 9×9 game, but the *mode* default for "casual, first games" still resolves to "on" per the table — the mode key is experience-relative, not literally gated to the Capture Go variant); A's client is silent, since A turned the cue off in a prior session and that preference persists across game types.
5. Game ends by resignation. Both clients render the end bow with "Arigatou gozaimashita."

No step in this sequence required either player to make a ceremony decision they hadn't already made once, earlier, from a settings screen or a skip toggle — which is the whole point of treating consent as state rather than as a repeated question.

## Roadmap obligations

- **Phase 2 (Play).** The commit–reveal nigiri sequence must run server-authoritative inside the Durable Object that hosts the game room (not client-computed), so neither player's client can be the source of the seed. `RitualPreference` moves from `localStorage` to a D1 user-preference row, migrated on first login from whatever `localStorage` held on that device. **Merge rule, for a player who set `RitualPreference` on more than one anonymous device before creating one account** (a real case an earlier draft of this bullet left unspecified): the merge is per-field, and `"skip"` wins over `"ask"` on any field where the two devices disagree. This is the safe direction, not an arbitrary tiebreak — re-showing a ritual to a player who already dismissed it on some other device violates the "asks once, honors the answer indefinitely" promise this document opens with more severely than under-showing it once more would; a player who wanted `"ask"` everywhere and forgot they skipped it on a second device loses nothing but seeing one ceremony they can turn back on from settings, same as always.
- **Phase 3 (Understand).** Automatic handicap/komi assignment (the plan's "automatic handicap-and-komi from rating gap") must call the same placement and komi tables this document points at in [Handicap Placement and Komi Values](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/handicap-placement-and-komi-values.md) — one source of truth for the numbers, referenced by both the match-setup logic and the handicap-confirmation ritual screen, never duplicated into a second table that can drift.
- **Phase 4 (Belong).** Teaching-game mode and the mentor ladder are candidate sites for a lineage-flavored ritual variant (a teacher's opening line differing from a peer match's) — out of scope here, but any such addition must pass through this document's consent schema (`RitualPreference`) rather than inventing a parallel skip mechanism.
- **All phases.** Any new ritual proposed after this document must be checked against the same three tests used throughout it: does it fire only when a real decision or boundary is live (Pillar 1); is it skippable with the skip remembered, not re-asked (Pillar 4); and would a traditional Go teacher recognize the practice (Pillar 5's own decision test).
