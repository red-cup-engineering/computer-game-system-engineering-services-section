# Note on the next-generation agentic EVE platform

Provenance: Claude's own reflection, 2026-08-05, written at Morgan's request
("how do we build the next gen agentic EVE orchestration platform that just
hasn't been made yet because no one has invested the tokens, and we now
can"). Epistemic status: design thinking, not commitment; promote pieces into
ROADMAP.md decisions as they're adopted.

## Why it hasn't been built

Every existing EVE tool — killboards, market sites, asset managers, skill
planners — is a query-answering machine: a human asks, a database answers.
The missing thing is not a better query machine. It is a standing research
organization around the player: agents that work between sessions, hold
hypotheses, check each other, and remember outcomes. Nobody built it because
each useful insight cost too much inference to produce continuously, and
because without harness discipline a fleet of agents produces confident mush.
Both constraints just moved: tokens are cheap in bursts, and the orchestration
patterns (pinned contracts, parallel fan-out, adversarial verification stages)
are proven — we used all of them today building v1.

## The shape: a quant desk, not a chatbot

The unit of value is the prepared briefing, not the answered question. Chat
is the follow-up interface; the platform's primary outputs are documents —
morning briefing, loss autopsy, weekly review, hypothesis updates — each
composed from cited canonical records. This is the aspirations note's "very
organized research desk," taken seriously as an org design:

- Collectors: scheduled agents refreshing observations within the ESI error
  budget (Workers cron). They produce records, never prose.
- Analysts: agents that turn deltas into findings ("your queue goes empty in
  36h", "this route's spread collapsed").
- Critics: adversarial agents that attack every recommendation before the
  player sees it — check citations against records, hunt stale data, name
  the assumptions that would break the conclusion. Token abundance is what
  makes a standing critic staff affordable; this is the single biggest
  quality difference vs every existing tool.
- Archivists: agents that maintain the hypothesis book and the decision →
  outcome ledger.

## The load-bearing substrate is the record format

The canonical schema'd records (in progress) are what make a multi-agent firm
possible at all: collectors and analysts and critics can only divide labor if
they exchange typed, versioned, provenance-carrying records rather than
prose. Adversarial verification is only mechanical when every claim cites a
record id. The observation store becomes the firm's shared memory; the
schemas are its contract law. Get this right and everything above it is
swappable — models, transports, even the web app.

## The hypothesis book

The step beyond briefings: standing, falsifiable statements the desk
maintains — "hauling Jita→Amarr in a Sigil clears 15M ISK/hr", "ice products
spike Sundays in Domain" — each with evidence for and against, confidence,
last-checked timestamps, and a record of every player decision made on its
basis and what happened after. The desk doesn't just answer; it accumulates
tested beliefs and retires refuted ones. This is "derive, never assert" and
the outcome-recording loop from the aspirations note, made into the central
data structure.

## Event-driven, not just scheduled

A killmail arriving is a trigger: the loss autopsy runs before the player
asks. A skill finishing, an order filling, a watched price crossing a line —
each wakes a narrow agent whose output is a record plus, when warranted, a
briefing item. The platform's rhythm: continuous small collections, episodic
deep analyses, and a human who logs in to find the thinking already done.

## The alignment that makes it legal and right

CCP's line: tools may inform; they may not act in-game. The network's own
operating doctrine — the single-finalizer rule, agents draft and the human
canonizes — is exactly the compliant shape. The player is the finalizer. The
platform's whole architecture (read-only ESI, decision support, provenance,
critics) enforces the EULA boundary structurally rather than by policy: there
is simply no actuator to misuse.

## Ecosystem

The MCP endpoint makes every user's own assistant a client of the desk. The
record format makes every future app a peer of the web app. Later, with
consent: shared observation pools per corporation — a corp quant desk whose
collectors are its members' granted scopes. That network effect (pooled
evidence, private conclusions) is the thing no third-party EVE tool has ever
had the substrate to attempt.

## Staged path

- v1 (built today): reactive tools, chat analyst, MCP endpoint, records.
- v2: scheduled collectors + the morning briefing (Workers cron; deltas).
- v3: hypothesis book + decision/outcome ledger; critics on every
  recommendation.
- v4: event triggers (killmail, skill, order) waking narrow agents.
- v5: multi-user shared desks (corp pools), third-party apps on the record
  format, burst-mode deep research (the token-burst pattern we used today,
  productized: "spend my weekly budget researching X").

## Honest constraints

ESI error budget is shared and precious — collectors must be budget-aware or
the desk DoSes itself. BYOK free tiers bound analyst depth per user; burst
work should batch. ESI cache staleness must surface in every briefing (the
records carry expiry; the UI must show it). And the failure mode that kills
trust is confident invention — which is why critics and citation-checking are
core staff, not features.
