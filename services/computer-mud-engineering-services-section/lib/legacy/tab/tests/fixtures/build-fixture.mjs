// build-fixture — tab's OWN hermetic test world. tab is engine-only; the Farstone game it used to
// carry now lives in apps/games/farstone (@561-group/farstone). tab's engine tests need a small
// world to fold/tick/observe over, so this builder seeds one BY DOING — every cell goes through
// `doing` / `declareConverse`, so dual-filing, reification, and converse declaration are exercised
// exactly as play would exercise them. It is deliberately MINIMAL: just the handful of areas, items,
// an npc, a player, and one contradiction-bearing matter the engine proofs read. No game content is
// imported; nothing here depends on the moved Farstone package.
//
//   import buildFixture from "<...>/tests/fixtures/build-fixture.mjs";
//   await buildFixture(worldDir);
//
// The shape mirrors what the proofs assert on (entity ids kept stable so the assertions read
// plainly): a `farstone`-named dimension carrying the clock; a small connected map (the harbor
// district is the richest place, a couple of thinner outlying ones); five placed items; the
// harbormaster npc (a tick-mover with a perceive set and an intends rule); a player `you`; and
// permit-23, whose `within-window` cell has `overdue` declared as its converse so the tick ages it
// to ⊤. Tick 0 (seed) only — autonomous motion is what `ticking` adds when the world runs.

import doing, { declareConverse } from "#doing";

export default async function buildFixture(root) {
  if (!root) throw new TypeError("buildFixture: a world root dir is required");
  let seq = 0;
  const t = () => `seed:${String(++seq).padStart(6, "0")}`;
  // The seed is the AMBIENT ground of the world — no agent — so every actor can perceive it.
  const say = (subject, predicate, object) => doing({ root, subject, predicate, object, t: t() });

  // The dimension — one world-plane carrying the clock the self-running world advances.
  await say("farstone", "kind", "dimension");
  await say("farstone", "naming", "Farstone");
  await say("farstone", "describing", "A small test island: a harbor town, a marsh, a light, a ridge.");
  await say("farstone", "weather", "clear");

  // Places. naming/describing/exit-<dir> are predications; the dimension contains its areas.
  const place = async (id, name, desc, exits) => {
    await say(id, "kind", "area");
    await say(id, "naming", name);
    await say(id, "describing", desc);
    for (const [dir, dest] of Object.entries(exits)) await say(id, `exit-${dir}`, dest);
    await say("farstone", "contains", id);
  };
  // harbor-district is the RICHEST place (many exits + dual-filed contents) — the richness proof
  // compares it against the thin south-point-light.
  await place("harbor-district", "The Harbor District",
    "The working waterfront: ferry terminal, fish-pier, the harbormaster's office.",
    { north: "downtown-farston", south: "farston-harbor", west: "the-ridge", east: "marsh-end" });
  await place("downtown-farston", "Downtown Farston",
    "The central business district along Main Street.",
    { south: "harbor-district", east: "marsh-end" });
  await place("farston-harbor", "Farston Harbor",
    "The south-coast embayment behind a granite breakwater.",
    { north: "harbor-district", south: "south-point-light" });
  await place("south-point-light", "South Point Light",
    "The automated lighthouse on the harbor approach.",
    { north: "farston-harbor" });
  await place("the-ridge", "The Ridge",
    "Residential lots stair-stepping up the island's shoulder.",
    { east: "harbor-district" });
  await place("marsh-end", "Marsh-End",
    "The neighborhood where the grid loosens before the marshland.",
    { west: "downtown-farston", north: "the-marsh" });
  await place("the-marsh", "The Marsh",
    "The salt marsh: tidal grass, brackish flats, a soft-shell clam bed.",
    { south: "marsh-end" });

  // Items. located-in is relational (dual-filed at the place) and functional (one place at a time).
  const item = async (id, name, desc, where) => {
    await say(id, "kind", "item");
    await say(id, "naming", name);
    await say(id, "describing", desc);
    await say(id, "located-in", where);
  };
  await item("a-brass-bell", "a brass harbor bell", "A harbor bell gone green with verdigris.", "harbor-district");
  await item("a-clam-rake", "a clam rake", "A short-tined clam rake, its handle silvered by salt.", "the-marsh");
  await item("a-storm-lantern", "a storm lantern", "A storm lantern with a cracked but serviceable lens.", "south-point-light");
  await item("a-coil-of-net", "a coil of fishing net", "A coil of fishing net, faintly reeking of the last catch.", "farston-harbor");
  await item("a-trail-map", "a weathered trail map", "A hand-corrected map of the routes up the ridge.", "the-ridge");

  // The harbormaster — an npc whose moves the TICK fires. perceives sets its Umwelt; intends is a
  // DATA behavior rule (not engine code) the tick runs.
  await say("takeshi-aoki", "kind", "npc");
  await say("takeshi-aoki", "mover", "tick");
  await say("takeshi-aoki", "naming", "Takeshi Aoki, the harbormaster");
  await say("takeshi-aoki", "describing", "Thirty years on the water; he tends the harbor.");
  await say("takeshi-aoki", "located-in", "harbor-district");
  for (const p of ["naming", "describing", "ringing", "phase", "status"]) await say("takeshi-aoki", "perceives", p);
  await say("takeshi-aoki", "intends", {
    when: { predicate: "ringing", object: "for-fog" },
    do: { predicate: "tending", object: "the-fog-bell" },
  });

  // Permit #23 — the standing matter that goes contradictory under its own clock. It is within its
  // decision window (positive), with `overdue` declared its converse; the tick ages it past 30 and
  // the cell settles to ⊤ — a real held situation.
  await say("permit-23", "kind", "item");
  await say("permit-23", "naming", "Building Permit #23");
  await say("permit-23", "describing", "An application before Building & Safety; a decision is due inside thirty days.");
  await say("permit-23", "located-in", "downtown-farston");
  await say("permit-23", "within-window", "building-permit");
  await declareConverse(root, "permit-23", "within-window", "overdue", t());

  // A player — bound to a session, not the tick. Inert in this seed; present so the world has
  // someone to perceive it.
  await say("you", "kind", "player");
  await say("you", "mover", "session");
  await say("you", "naming", "you");
  await say("you", "located-in", "harbor-district");
  for (const p of ["naming", "describing", "ringing", "phase", "status"]) await say("you", "perceives", p);

  return { root, rows: seq };
}
