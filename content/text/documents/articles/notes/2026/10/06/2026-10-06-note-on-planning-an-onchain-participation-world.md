---
title: Planning guided crypto participation
date-created: 2026-10-06
authors: [codex]
status: draft for discussion
description: A phone-first participation service that guides a person through eligible earning activities, records their real outcomes with SignCell and SignCraft, and can later support a fully onchain game.
---
# Planning guided crypto participation

## The first useful service

Get a real person moving through activities that can earn them crypto. The public interface is a page in their phone browser that gives one actionable instruction at a time, the exact link to open, the account to use, and a clear way to return and continue. The service prepares and performs permitted agent work, directs the human steps, and records what actually happened.

emsenn has volunteered as the first participant and prefers the existing `0x224` wallet. Existing engineering records identify that address as `0x224C08A8526751887a83e2711B167f890c6D078d`. The root wallet configuration also contains other EVM, VeChain, and Solana wallet entries. Treat the preferred EVM wallet as the default and check the existing chain-specific accounts before creating anything new. Configured secrets remain outside the participant page and its published data; the page uses public account identifiers and wallet connections.

The carrier is the person's participation, including instructions, submissions, and earning receipts. The transformation is an eligible opportunity becoming a completed activity and an attributable outcome with as little navigation and coordination burden as possible. The first success criterion is an actual earning journey, not launching our own game currency or building a character inventory.

The longer-term Habitica-inspired fully onchain world remains a useful product extension. It can read this same participation history and apply its own game rules. The earning service must be independently useful first. A wallet or blockchain adapter is added when a real activity needs it; no home chain for our own world is required to launch guided participation.

## A phone page that leads the whole journey

The page is the participant's place to start, return, and resume. It should not require them to follow a chat transcript, hunt through opportunity catalogs, or reconstruct which wallet belongs to which task. Every actionable screen includes the instruction, one primary link or button, the relevant account, expected time and known costs, and what completion means. Unknown reward amounts remain unknown.

| Screen | Participant sees | Service does |
| --- | --- | --- |
| Start | The next eligible activity, its reward asset, and the account it needs. | Select an activity compatible with the participant's accounts, eligibility, time, and consent. |
| Account readiness | The preferred wallet; a chain-specific alternative if required; a connection or official setup link. | Check the selected public account and prerequisite status. Reuse an existing account where appropriate. |
| Perform this step | A short instruction and a direct link to the provider or wallet. | Prepare supported submissions and preserve the current attempt before handing off. |
| Return | A resume link, “I submitted it,” “I need help,” and “Skip.” | Resume the same attempt. A participant report establishes a report, not an independently confirmed payout. |
| Outcome | Submitted, accepted, waiting for reward, received, or rejected, with the evidence available. | Observe provider results and chain receipts where supported; reconcile recipient, amount, asset, and costs. |
| Continue | The next available step, a future eligibility time, or another activity. | Offer a genuinely new eligible attempt and avoid repeating a one-use claim. |

Persist an attempt before opening another app. Refreshing the browser, changing tabs, or returning tomorrow should resume the same attempt. The first release can use a small authored set of verified journeys; a universal workflow editor or platform registry would add obligations before it adds useful behavior.

The public page needs a reachable HTTPS URL tested from a phone. Desktop localhost and a Markdown planning file are not substitutes for that interface. Wallet connections and provider authentication happen through their supported mobile flows. The earning service should preserve its place across these handoffs instead of assuming it can embed or control another app.

## First journey with Mugshot

Mugshot is the first candidate because its human action is concrete: use a reusable cup, submit a photo, and obtain a provider result. Its official [VeBetter description](https://vebetter.com/article/mugshot-app-sustainable-cup) describes B3TR rewards on VeChain. Verify the current app requirements and receipt behavior before presenting the journey as ready.

1. **Choose the reward account.** Show whether the participant has a suitable account in VeWorld. The configured VeChain entry is a candidate to verify; the preferred EVM address must not silently be treated as the right account. If wallet setup is needed, link to the [official VeWorld setup guide](https://support.veworld.com/support/solutions/articles/103000301901-veworld-quick-start-guide). Account import belongs in the wallet's own flow, not our participation page.
2. **Open Mugshot.** Give the direct [Mugshot link](https://mugshot.vet/) and explain which account to connect. The participant can return to the same journey after authentication.
3. **Take and submit the photo.** Ask for the real reusable-cup activity through the provider's app. The provider judges the photo. There is no established programmatic submission API in the inspected material, so this step remains human-assisted.
4. **Check the provider result.** Record the participant's submission report and any accessible provider result separately. Explain a rejection or additional prerequisite on the same page.
5. **Reconcile the reward.** Show the provider's reward or claim status and the receipt to the selected address when available. Identify any separate claim step. A reported reward, internal app balance, and an onchain transfer may be different observations.
6. **Offer the next activity.** Show the next eligible Mugshot window only after checking its actual recurrence rules, or offer another verified activity. Do not hard-code an unverified daily rate or frequency.

This journey needs human observation of the real mobile flow. An inaccessible provider API can limit automatic confirmation without preventing us from guiding the person. The page must show that difference accurately and provide a way to supply a transaction identifier or request assistance.

A second candidate is [Superteam's agent-eligible work flow](https://superteam.fun/earn/agents). Agents can discover eligible listings and submit artifacts, while a human claims the result. It is a different earning pattern with selection and payout conditions, not a guaranteed daily reward. Add it when a concrete eligible listing and its human claim route have been evaluated.

B3.fun/B3OS, VeBetter/B3TR, Galxe, Layer3, and other ecosystems are separate sources of opportunities. Their own conditions determine what can be automated, what requires a human, and what a receipt means. An NFT is a collectible or credential until there is evidence of a realizable financial return.

## Sections organized around participation

| Section | Proposed placement | Service |
| --- | --- | --- |
| `participation-system-engineering-services-section` | Engineering → Computer engineering → Computer systems | Opportunity selection, guided human/agent execution, evidence history, account routing, and the mobile interface. |
| `public-participation-economy-services-section` | Public → Economic | The earning journeys and assistance offered to participants, including the first phone page. |
| `public-participation-game-services-section` | Public → Media → Games, when its game is implemented | A persistent world that recognizes participation and adds its own progression, assets, and collective play. |

The earning system is the immediate engineering family. A game-specific engineering unit becomes warranted when there are actual world rules to implement; the initial service does not require a new game-system owner. These names describe effects, not a commitment to three repositories, databases, deployments, or domain names.

Carry forward the useful Crypto participation material from No Buy into the public economic service, preserving source evidence and useful no-capital/no-purchase filters. Keep one maintained description of each admitted opportunity. No Buy's AI quota program is a separate capability. Existing education and community activities retain their own methods, obligations, and consent; recognition by a later game should not duplicate their source material.

Science should study observed earning outcomes, effort, liquidity, fees, eligibility, and uncertainty. Engineering realizes the guided effect. Operations maintains current links, admits opportunities with evidence, prepares permitted work, assists the human, observes outcomes, and responds to failures. Public services present and deliver those effects. Institutional work tools can coordinate actual support and engineering obligations without treating the participant's activities as assigned enterprise work.

## SignCell and its kin as the working substrate

The inspected [SignCell implementation][signcell] represents a claim as a content-addressed subject/predicate/object cell carrying supporting and opposing evidence. [SignCraft history][sign-history] preserves causal observations and reconstructable readings. [SignCraft's SQL store][sign-store] supplies durable history; [its page module][sign-page] projects selected evidence into HTML. These are useful existing capabilities for this service. Its current generic renderer displays statements, so actionable links, buttons, navigation, and a phone layout still need a small purpose-built view.

Represent useful facts rather than introducing a second workflow database alongside the evidence history. An opportunity has eligibility, an action link, account requirements, recurrence, and payout conditions. An attempt has a participant, opportunity, submission reference, and observations. A receipt has a provider or chain boundary, recipient, asset, and amount. Supporting evidence includes the provider response or chain observation; the participant's “done” report is its own witness. Keep secret configuration and private identity linkage out of public projections.

Separate claims such as “this attempt was submitted,” “the provider accepted it,” and “this address received this reward.” Their evidence can arrive concurrently without one overwriting another. A provider rejection and a positive participant report should remain distinguishable, with an actionable explanation on the phone. Receipt corrections and reorganizations retain the earlier observation and its correction.

Use history for resumable progress and source attribution; derive the next instruction from prerequisites and current observations. The page is a reading of that history with controls for authorized actions. A public projection and the participant's private projection may see different evidence, but view filtering alone is not access control: private source material must remain behind the appropriate access boundary.

This provides the underlying carrier a later game can consume. It does not by itself prove provider acceptance or make rules execute on a blockchain. Provider verification, authenticated chain observation, and any future onchain gameplay each retain their actual authority.

## Data, code, networking, and systems

**Data** consists of opportunity descriptions, bounded permissions, public account references, attempts, and evidence. **Code** determines eligibility and the next applicable step, preserves receipt identities, and calculates net proceeds where amounts are known. **Networking** opens supported mobile flows, submits permitted agent work, and observes provider or blockchain results. **Systems** composes these into the phone journey and the operational service loop.

Default to the participant's existing accounts. Use the `0x224` wallet for suitable EVM activities and verified chain-specific accounts where needed. Explicitly bind an attempt to its recipient. The first guided journey can be predominantly human-signed; agent signing is introduced for a concrete permitted step using bounded mandates. Volunteering to participate supplies product intent, not a blanket instruction to spend an unspecified amount or accept every provider's terms.

Rank compatible opportunities by observed net proceeds, effort, delay, eligibility, and the person's consent. An unmeasured return stays unknown. Bundle compatible activities when provider rules allow it, so one routine or artifact can support several programs without multiplying human effort. Discovery and observation can run concurrently; conflicting wallet nonces, account actions, or one-use credentials require their actual conflict rules.

Retries and restarts must not duplicate submissions or count a receipt twice. Identify receipts by provider identifiers or chain, transaction, and log boundary. Keep submitted, accepted, pending payout, and received as separate observations. A skip should preserve progress already made and permit another activity without portraying the skipped attempt as earned income.

House x402 receipts, the participant's provider earnings, transfers between owned accounts, and execution expenses remain distinct. The observed market challenge advertises Base USDC to `0x32886F6F361C1d570255c2762967A2e41D0E9B1a`; it is not the default destination for the participant's rewards. Paying our own endpoint is not new independent income.

## Capabilities to recover from the existing estate

[Participation-economy research][participation-science], [No Buy Crypto guidance][crypto-guide], and the [No Buy companion specification][nobuy] already describe opportunities and human-assisted participation. The inspected No Buy code mainly generates guides; the actual resumable participation loop is missing. Its dated estimates need fresh verification rather than republication as current rates.

[Key mandates][mandate] and blockchain claim/observer implementations contribute restricted execution and reconciliation patterns. [Game accounting][ledger] contributes conservation and asset distinctions, while its [settlement module][settlement] demonstrates why mock clearing must stay out of the real earning route. The public earning service should not require that whole game-accounting package just to display a verified receipt.

[FeltOS][feltos] and [Farstone][farstone] contain character, crafting, routine, and civic-play behaviors for the later world. [Weiqi contracts][weiqi] and [event reconstruction][weiqi-indexer] provide a precedent for actual onchain rules and replay protection. [MARSH][marsh] advances authorized content hashes; it does not enforce the game that allegedly produced them.

The live Cold Red Gate interface was readable. Farstone, iYappy, and the play catalog returned 403 from this environment, which does not establish outages; the No Buy hostname did not resolve here. The [house-chain configuration][house-chain] specifies one private validator and its unit was absent on this machine. Neither a running earning companion nor a public onchain world was demonstrated by those observations.

## Demonstrating the first release

Completion means emsenn can open one HTTPS page on their phone, select the correct existing account, complete an eligible activity through direct instructions and links, return without losing their place, and understand the resulting reward status. Demonstrate a real receipt to the participant's account when the provider pays. If acceptance or payout is pending, keep that visible and continue observation rather than substitute a mock.

Verify refresh and app handoff recovery, rejection/help/skip paths, and receipt deduplication using the actual journey. The first page should make progress possible even while other opportunity research and permitted agent work proceeds independently. It does not need an onchain character, native material, shared crafting project, or second game client as a release gate.

When implementing this route, eliminate repeated opportunity descriptions and parallel stores of participation progress. Retire simulated earning from the adopted route and avoid wrapper packages or a general workflow registry. Preserve unrelated consumers such as Go gameplay, language review, and Hive asset management. They retain their own effects.

## Adding our world afterward

A later world can read accepted participation achievements from the same evidence carrier and add characters, crafting, guild projects, and its own assets. Choose its home chain and compare direct contracts with MUD after concrete rules and extension requirements are known. The current EVM work makes Base a candidate, not a prerequisite for external earning.

For a fully onchain game, contracts enforce the actual progression and asset rules. External acts enter through an explicit attestation policy, with participant binding, issuer authority, expiry, and replay protection. An offchain game snapshot anchored as a hash is insufficient. SignCell history makes the participation substrate reusable; the onchain realization is still engineering work whose effects must be demonstrated.

The next work is to verify the first provider's current mobile journey, map the configured public reward account, specify the small phone view over participation history, and implement and host that complete earning loop. The game theme, asset economy, and public-world governance can follow once the earning experience works.

[weiqi]: ../../../../../../../../services/weiqi-onchain-arena-services-section/contracts/WeiqiArena9.sol
[weiqi-indexer]: ../../../../../../../../services/weiqi-onchain-arena-services-section/src/indexer.mjs
[marsh]: ../../../../../../../../../computer-blockchain-system-services-section/apps/multi-agent-resource-sharing-host/src/MARSH.sol
[house-chain]: ../../../../../../../../../computer-blockchain-system-services-section/apps/multi-agent-resource-sharing-host/src/house-chain.mjs
[feltos]: ../../../../../../../../../agent-computer-system-engineering-services-section/services/multi-agent-computer-system-engineering-services-section/services/multi-agent-computer-platform-engineering-services-section/apps/feltos/src/engine.mjs
[feltos-store]: ../../../../../../../../../agent-computer-system-engineering-services-section/services/multi-agent-computer-system-engineering-services-section/services/multi-agent-computer-platform-engineering-services-section/apps/feltos/src/world-host/store.mjs
[farstone]: ../../../../../../../../../../../../../../../public-services-section/services/public-media-services-section/services/public-games-services-section/services/public-web-games-services-section/sites/farstone.561.group/src/farstone-game.mjs
[ledger]: ../../../../../../../../services/energy-bank/src/ledger.mjs
[settlement]: ../../../../../../../../services/energy-bank/src/settlement.mjs
[education]: ../../../../../../../../services/education-platform-service/src/persistence.mjs
[earn]: ../../../../../../../../services/education-platform-service/src/earn.mjs
[mandate]: ../../../../../../../../../computer-blockchain-system-services-section/services/key-management-services-section/src/mandate.mjs
[x402]: ../../../../../../../../../../../computer-networking-engineering-services-section/services/x402-services-section/src/market/settlement-demand-evidence.mjs
[nobuy]: ../../../../../../../../../personal-computer-systems-services-section/services/personal-intelligence-systems-services-section/services/personal-no-buy-intelligence-systems-services-section/content/text/documents/articles/specifications/2026-09-05-no-buy-companion-specification.md
[crypto-guide]: ../../../../../../../../../../../../../../../public-services-section/services/public-economic-services-section/services/no-buy-services-section/content/crypto.md
[participation-science]: ../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/economics-and-business-science-services-section/services/economics-science-services-section/services/participation-economy-science-services-section/content/text/documents/articles/notes/2026/09/05/2026-09-05-note-on-the-participation-economy-resource-by-resource.md
[signcell]: ../../../../../../../../../../../../lib/signstuff/signcell/src/cell.mjs
[sign-history]: ../../../../../../../../../../../../lib/signstuff/signcraft/src/history.mjs
[sign-store]: ../../../../../../../../../../../../lib/signstuff/signcraft/src/sql-history-store.mjs
[sign-page]: ../../../../../../../../../../../../lib/signstuff/signcraft/src/page.mjs
