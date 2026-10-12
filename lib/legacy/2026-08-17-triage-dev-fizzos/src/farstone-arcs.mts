/**
 * `@emsenn/fizzos/farstone-arcs` — the island's standing story arcs, as player choices with
 * consequence. Where the Director mints small errands from need, an *arc* is a larger situation the
 * world holds open until the player resolves it — and the resolution changes the world for good.
 *
 * The first arc is the lore's centerpiece (`lore.md` §"The Off-Season"): the **dredging permit**
 * (Application 23), held contested between Coilin Vey (who wants a deep-water channel dredged) and
 * Brannaugh Ross (whose clam ground the dredge would silt). The world *carries* the contradiction
 * until a player files a petition at the records clerk's office — and then it is settled, with a
 * real, irreversible cost: grant the dredge and the marsh clam bed fouls; deny it and the channel
 * stays a dream. Either way a fisher is wronged, and the feud takes the shape the player gave it.
 *
 * This is choice→consequence woven through the systems already built — interiority (to discover the
 * dispute), movement (to reach the office), ecology (the silted bed), and the feud (the sour loser).
 */
import type { GameCommand } from "./game.mjs";
import { hashStr, rngFor } from "./world-clock.mjs";

const PERMIT = "the-dredging-permit";

export const petition: GameCommand = (ctx, actor, arg) => {
  const side = arg.trim().toLowerCase();
  if (ctx.value(PERMIT, "decision-status") !== "contested") {
    const settled = ctx.value(PERMIT, "decision-status");
    return settled === null ? "There is no live petition to file." : `Application 23 is already settled (${settled}); the clerk waves you off.`;
  }
  const room = ctx.roomOf(actor);
  if (room === null || !ctx.tagsOf(room).includes("civic")) {
    return "You can only file a petition at the records clerk's office — downtown, in the civic blocks.";
  }
  if (/coilin|dredge|grant|channel/.test(side)) {
    ctx.tell([{ e: PERMIT, a: "decision-status", v: "granted" }]);
    // The dredge is cut — and the silt fouls Brannaugh's marsh clam ground. A lasting wound.
    for (const r of ctx.rooms()) {
      if (ctx.tagsOf(r).includes("shellfish")) {
        ctx.tell([
          { e: r, a: "pollution", v: String(ctx.number(r, "pollution", 0) + 8) },
          { e: r, a: "shellfish-closed", v: "true" },
        ]);
      }
    }
    if (ctx.things().includes("brannaugh-ross")) ctx.tell([{ e: "brannaugh-ross", a: "embittered", v: "true" }]);
    return "You file in favour of the dredge. The channel will be cut — and the silt will choke the marsh clam bed. Coilin's cause carries; Brannaugh's ground is lost, and she will not forget it.";
  }
  if (/brannaugh|clam|deny|marsh|refuse/.test(side)) {
    ctx.tell([{ e: PERMIT, a: "decision-status", v: "denied" }]);
    if (ctx.things().includes("coilin-vey")) ctx.tell([{ e: "coilin-vey", a: "embittered", v: "true" }]);
    return "You file against the dredge. The clam bed is spared and the deep-water channel stays a dream. Brannaugh's cause carries; Coilin seethes, and the feud takes that shape.";
  }
  return "Petition for whom? 'petition coilin' (grant the dredge) or 'petition brannaugh' (spare the clam bed). Choose, and the world will hold to it.";
};

/**
 * The Hydrant-23 arc (`biome.md` §water-quality): two inspectors filed conflicting status on the
 * same hydrant within 24h, so the substrate holds a **contested ⊤** the council cannot resolve away.
 * Under the charter's precautionary principle it is treated as *fail* — a standing boil-water
 * advisory — until a **re-inspection** settles it. The player can dispatch that re-inspection from
 * the records office; the true state is seeded (replay-exact), most alarms false but not all. This
 * is governance as gameplay: the mundane civic contradiction, played straight, that the world holds.
 */
export const inspect: GameCommand = (ctx, actor, arg) => {
  const target = (arg.trim().toLowerCase().replace(/\s+/g, "-") || "hydrant-23");
  const status = ctx.value(target, "water-quality");
  if (status !== "contested") {
    return status === null ? `There is no contested inspection at "${target}". (try 'inspect hydrant-23')` : `${target.replace(/-/g, " ")} is settled (${status}); no re-inspection is needed.`;
  }
  const room = ctx.roomOf(actor);
  if (room === null || !ctx.tagsOf(room).includes("civic")) {
    return "Re-inspections are dispatched from the records clerk's office — downtown, in the civic blocks.";
  }
  // The seeded true state: the precautionary fail might be a false alarm, or might be real.
  const pass = rngFor(ctx.number("the-world", "world-seed", 1), hashStr(target)) > 0.4;
  ctx.tell([
    { e: target, a: "water-quality", v: pass ? "pass" : "fail" },
    { e: target, a: "advisory", v: pass ? "clear" : "boil-water" },
  ]);
  return pass
    ? `You dispatch a re-inspection of ${target.replace(/-/g, " ")}. The re-test comes back clean — the contradiction resolves to a pass, and the boil-water advisory lifts.`
    : `You dispatch a re-inspection of ${target.replace(/-/g, " ")}. The re-test confirms the fail — the advisory stands, and the source of the contamination must be found.`;
};
