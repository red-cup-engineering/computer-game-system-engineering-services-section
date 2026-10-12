/**
 * `@emsenn/fizzos/campaign` — a long-horizon player arc (the retention loop). Where the Director
 * mints small errands and the dispute-arcs offer single choices, a **campaign** is a *staged*
 * questline that spans hours: each stage completes from the player's own progress through the other
 * systems — earn a living, learn a trade, raise a roof, settle the island's dispute, become a pillar
 * of the harbor — and completing one unlocks the next. No stage is a fetch-flag bolted on; each is a
 * threshold *read off the world the player has already changed*, so the campaign is the systems
 * themselves, given a spine and a destination. This is what pulls a player back: a place to get to.
 */

/** A per-player snapshot the stages read — assembled by the scene from the player's settled state. */
export interface CampaignView {
  readonly coin: number;
  readonly topSkill: number;
  readonly faculties: number;
  readonly ownsBuilt: boolean;
  readonly permitResolved: boolean;
  readonly topStanding: number;
  readonly thoughtsFixed: number;
}

export interface Stage {
  readonly id: string;
  readonly title: string;
  readonly task: string;
  readonly reward: number;
  done(v: CampaignView): boolean;
}

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly Stage[];
}

/**
 * "The Off-Season" — the island's founding campaign, drawn straight from the lore's themes: arrive
 * with nothing, find your feet, learn the working waterfront's trades, win a place of your own, take
 * a hand in the island's politics, and end as someone the harbor reckons with. Each threshold is a
 * fact the player constructs through ordinary play across every other system.
 */
export const OFF_SEASON: Campaign = Object.freeze({
  id: "off-season",
  name: "The Off-Season",
  stages: Object.freeze([
    { id: "feet", title: "Find Your Feet", task: "Make 60 coin on the lean waterfront — trade, fish, or work.", reward: 25, done: (v: CampaignView) => v.coin >= 60 },
    { id: "trade", title: "A Trade in Hand", task: "Train any skill to apprentice (level 15) by doing the work.", reward: 30, done: (v: CampaignView) => v.topSkill >= 15 },
    { id: "eye", title: "A Keener Eye", task: "Internalize a Thought — let the island reshape how you see.", reward: 30, done: (v: CampaignView) => v.thoughtsFixed >= 1 },
    { id: "roof", title: "A Roof of Your Own", task: "Raise a structure of your own — gather the materials and build.", reward: 40, done: (v: CampaignView) => v.ownsBuilt },
    { id: "permit", title: "A Hand in the Dispute", task: "See the dredging-permit dispute resolved — by your petition or another's.", reward: 50, done: (v: CampaignView) => v.permitResolved },
    { id: "pillar", title: "Pillar of the Harbor", task: "Win a faction's friendship (standing 40+). Become someone Farstone reckons with.", reward: 80, done: (v: CampaignView) => v.topStanding >= 40 },
  ]),
});

/** The stage a player stands at (index); past the last means the campaign is complete. */
export const stageAt = (campaign: Campaign, index: number): Stage | null => campaign.stages[index] ?? null;

/** The campaign read for a player — progress, the current task, and what's done. */
export function campaignReport(campaign: Campaign, index: number, v: CampaignView): string {
  if (index >= campaign.stages.length) return `${campaign.name}: complete. You are a pillar of the harbor — the island knows your name.`;
  const lines = [`${campaign.name} — stage ${index + 1}/${campaign.stages.length}: ${campaign.stages[index]!.title}`, `  ${campaign.stages[index]!.task}`];
  for (let i = 0; i < index; i++) lines.push(`  ✓ ${campaign.stages[i]!.title}`);
  void v;
  return lines.join("\n");
}
