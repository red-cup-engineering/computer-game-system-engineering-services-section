/**
 * `@emsenn/fizzos/director` — the emergent quest Director (the ν→μ keystone).
 *
 * Farstone's lore is explicit: *"Nobody wrote the story of the flats running dry; the systems
 * produced it."* The Director is where that becomes gameplay. It is a **ν-type** — a standing
 * world-cycle that never completes, only observes — that reads the live simulation each tick and,
 * where a situation has sharpened past a threshold, **mints a μ-type quest**: a finite errand that
 * completes exactly when its element is constructed. No quest is authored; the Director reads them
 * off the world's own pressure.
 *
 * The first demand it mints is the lore's beating heart: **hunger**. An NPC the simulation has
 * driven hungry (needs drift in `npc-life`; the climate shuts the clam bed and runs the off-season
 * up) posts that it `wants` food and will pay. Bring it any edible thing and the μ-element exists —
 * the give-machinery completes it: the NPC is relieved, you are paid, and your standing with their
 * faction rises. Climate → need → demand → trade → reputation, one self-renewing loop. This is how
 * a small lean world makes hundreds of hours of stories without a hand on the wheel.
 */
import type { GameSystem } from "./game.mjs";
import { hashStr } from "./world-clock.mjs";

/** The hunger at which an NPC will start asking strangers for food. */
export const HUNGER_DEMAND = 14;
/** The hunger at which a fed NPC withdraws its standing demand. */
export const HUNGER_SATED = 6;

/** What an NPC's needs would have it ask for — the demand the Director mints, or null. */
export function demandFor(hunger: number): { want: string; reward: number } | null {
  if (hunger >= HUNGER_DEMAND) return { want: "edible", reward: 5 + hunger };
  return null;
}

/**
 * Standing *supply* demands keyed on an NPC's trade — the inn always wants fish for the stew-pot,
 * the smith iron for the forge, the shipwright timber. These mint courier/supply errands (bring the
 * material, get paid), renewing after each fulfilment: a steady, varied quest stream off the cast's
 * own work, not a fixed list. The first matching role wins.
 */
const ROLE_WANTS: readonly { readonly tag: string; readonly want: string; readonly reward: number }[] = Object.freeze([
  { tag: "innkeeper", want: "fish", reward: 10 },
  { tag: "smith", want: "iron", reward: 16 },
  { tag: "shopkeeper", want: "fish", reward: 9 },
  { tag: "lamp-keeper", want: "fiber", reward: 8 },
]);

export function roleDemandFor(tags: readonly string[]): { want: string; reward: number } | null {
  const role = ROLE_WANTS.find((r) => tags.includes(r.tag));
  return role === undefined ? null : { want: role.want, reward: role.reward };
}

/**
 * The Director system: each tick, a living NPC whose hunger has crossed the threshold posts a
 * standing food demand (and withdraws it once fed). Staggered by id so the harbour doesn't all cry
 * out at once. The demand is plain settled cells (`wants`, `want-reward`) the give-path reads.
 */
export const farstoneDirector: GameSystem = (ctx) => {
  for (const npc of ctx.things()) {
    if (!ctx.tagsOf(npc).includes("npc") || ctx.value(npc, "condition") === "dead") continue;
    if (ctx.tick % 5 !== hashStr(npc) % 5) continue; // stagger the cadence across the cast
    const hunger = ctx.number(npc, "need:hunger", 0);
    const wants = ctx.value(npc, "wants") ?? "";
    // Hunger comes first; otherwise the NPC's trade posts its standing supply need.
    const demand = demandFor(hunger) ?? roleDemandFor(ctx.tagsOf(npc));
    if (demand !== null && wants === "") {
      ctx.tell([{ e: npc, a: "wants", v: demand.want }, { e: npc, a: "want-reward", v: String(demand.reward) }]);
      const room = ctx.roomOf(npc);
      const cry = demand.want === "edible" ? `${ctx.nameOf(npc)} looks half-starved. "I'd see someone right for a bite of something."` : `${ctx.nameOf(npc)} calls out: "I'll pay for ${demand.want}, if you've any to spare."`;
      if (room !== null) ctx.broadcast(room, cry);
    } else if (demand === null && wants === "edible") {
      // Only a *fed* NPC withdraws a hunger demand; standing supply demands persist until filled.
      if (hunger < HUNGER_SATED) ctx.tell([{ e: npc, a: "wants", v: "" }, { e: npc, a: "want-reward", v: "0" }]);
    }
  }
};

/**
 * A climate-driven quest: when a storm has closed the harbor, the Watch (or any civic NPC) calls
 * for **timber to shore up the breakwater** — a μ-errand that exists *only while the storm rages*,
 * pays well, and lifts your standing with the Watch when fulfilled. Conditional, emergent content:
 * the weather writes the quest. It withdraws when the storm lifts. (Reuses the `wants` machinery.)
 */
export const stormRecovery: GameSystem = (ctx) => {
  const stormClosed = ctx.value("the-world", "harbor-closed") === "true";
  for (const npc of ctx.things()) {
    if (!ctx.tagsOf(npc).includes("npc") || ctx.value(npc, "condition") === "dead") continue;
    const civic = ctx.tagsOf(npc).some((t) => t === "faction:watch" || t === "harbormaster" || t === "civic");
    if (!civic || ctx.tick % 5 !== hashStr(npc) % 5) continue;
    const wants = ctx.value(npc, "wants") ?? "";
    if (stormClosed && wants === "") {
      ctx.tell([{ e: npc, a: "wants", v: "timber" }, { e: npc, a: "want-reward", v: "30" }]);
      const room = ctx.roomOf(npc);
      if (room !== null) ctx.broadcast(room, `${ctx.nameOf(npc)} shouts over the gale: "The breakwater's taking damage — bring me timber and I'll pay well for it!"`);
    } else if (!stormClosed && wants === "timber") {
      ctx.tell([{ e: npc, a: "wants", v: "" }, { e: npc, a: "want-reward", v: "0" }]);
    }
  }
};

/** The single-valued cells the Director settles — registered functional so traces compact. */
export const FARSTONE_DIRECTOR_FUNCTIONAL: readonly string[] = Object.freeze(["wants", "want-reward"]);
