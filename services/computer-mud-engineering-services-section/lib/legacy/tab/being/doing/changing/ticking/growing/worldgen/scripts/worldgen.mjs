// worldgen — a PROCEDURAL WORLD GENERATOR: a STAGE for emergent stories. Where grow lays a single
// quasicrystalline coil, worldgen builds a SIZABLE, CONNECTED, VARIED, POPULATED place — regions
// of biome-clustered areas wired north/south/east/west into a walkable map, scattered with
// resources (food/rest/recreation), items (material+quality), and npcs (traits/needs/skills/home)
// that the OTHER systems (needs, mood, AI, crafting) act on.
//
// Like grow, worldgen never touches `fs` and never reads the clock: every write goes through
// `doing`, and t is a deterministic counter (`gen:NNNNNN`) so replay is byte-stable. Nothing is
// random — every choice is derived from an integer `seed` through the hash `h` below, so the same
// seed yields the same world byte-for-byte, and different seeds yield different worlds.
//
// THE MAP. Regions are laid in a RING (region r links to region r+1, wrapping), so the whole map
// is traversable region-to-region. Inside a region the areas form a near-square GRID wired by
// exit-north/south/east/west (BOTH directions written, so the map is walkable). The grid's
// top-left area is the region's GATEWAY: each region's gateway exits NORTH to the next region's
// gateway and SOUTH back, stitching the rings into one connected world.
//
// generate({ root, seed=1, regions=5, areasPerRegion=8, npcs=16, t? })
//   -> { areas:[id], regions:[id], npcs:[id], resources:[id], items:[id] }

import doing from "#doing";

// h — the deterministic integer hash from the brief. Pure; no RNG, no clock. Mixes a 32-bit int
// into a well-distributed 32-bit unsigned int, so h(seed*K + index) gives a stable per-choice draw.
const h = (n) => {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  return (n ^ (n >>> 15)) >>> 0;
};

// draw — a stable pseudo-draw for a named purpose: fold a string key into the mix so different
// facets of the same (seed,index) never collide. The key chars perturb the hash input.
const draw = (seed, index, key) => {
  let k = (seed * 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca77);
  for (let i = 0; i < key.length; i += 1) k = Math.imul(k ^ key.charCodeAt(i), 0x27d4eb2d);
  return h(k >>> 0);
};

const pick = (arr, n) => arr[n % arr.length];

// --- word-banks: flavorful, deterministic names ----------------------------------------------
const BIOMES = ["marsh", "wood", "ridge", "shore", "town", "valley"];

// Per-biome adjectives + features, so "marsh + flats" reads as a marsh and "ridge + crag" reads as
// a ridge. Indexed by hash → "the Saltmarsh Flats", "Greywater Hollow", etc.
const BIOME_WORDS = {
  marsh: { adj: ["Salt", "Grey", "Reed", "Mire", "Fen", "Bog"], feat: ["Flats", "Marsh", "Hollow", "Mire", "Slough", "Fen"] },
  wood: { adj: ["Elder", "Thorn", "Oak", "Birch", "Dark", "Moss"], feat: ["Wood", "Grove", "Thicket", "Glade", "Stand", "Copse"] },
  ridge: { adj: ["Grey", "Wind", "Stone", "High", "Iron", "Cold"], feat: ["Ridge", "Crag", "Bluff", "Scarp", "Spur", "Tor"] },
  shore: { adj: ["Salt", "Tide", "Gull", "Pearl", "Drift", "Cobble"], feat: ["Shore", "Cove", "Strand", "Reach", "Bar", "Spit"] },
  town: { adj: ["Old", "Market", "Kings", "Mill", "Harbor", "Stone"], feat: ["Town", "Crossing", "Market", "Quarter", "Green", "Row"] },
  valley: { adj: ["Green", "River", "Long", "Sun", "Deep", "Hidden"], feat: ["Valley", "Vale", "Dale", "Hollow", "Bottom", "Glen"] },
};

const REGION_WORDS = {
  adj: ["North", "South", "East", "West", "Upper", "Lower", "Far", "Near", "Wild", "Lost", "Broken", "Golden"],
  noun: ["Marches", "Reach", "Hundred", "Wolds", "Downs", "Holdings", "Expanse", "Frontier", "Bounds", "Country"],
};

// nameArea — "the <Adj><feat>" or "<Adj> <feat>", chosen deterministically. Two name shapes so the
// world doesn't read as a template.
function nameArea(seed, idx, biome) {
  const w = BIOME_WORDS[biome];
  const adj = pick(w.adj, draw(seed, idx, "area-adj"));
  const feat = pick(w.feat, draw(seed, idx, "area-feat"));
  return draw(seed, idx, "area-shape") % 2 === 0 ? `the ${adj}${feat.toLowerCase()}` : `${adj} ${feat}`;
}

function nameRegion(seed, idx) {
  const adj = pick(REGION_WORDS.adj, draw(seed, idx, "region-adj"));
  const noun = pick(REGION_WORDS.noun, draw(seed, idx, "region-noun"));
  return `the ${adj} ${noun}`;
}

const TRAITS = ["industrious", "lazy", "brave", "timid", "kind", "greedy", "curious", "gloomy", "cheerful", "tough"];
const SKILLS = ["fishing", "cooking", "building", "talking"];
const NEED_KINDS = ["need:hunger", "need:rest", "need:recreation"];
const MATERIALS = ["wood", "iron", "stone", "cloth", "fish"];
const FIRST_NAMES = ["Bram", "Edda", "Corin", "Mira", "Tomas", "Sela", "Garr", "Wren", "Holt", "Inga", "Per", "Yula", "Fenn", "Osa", "Dane", "Liss"];
const LAST_NAMES = ["Saltmere", "Greywood", "Ridgely", "Fenwick", "Marsh", "Carrow", "Dunn", "Oakhand", "Tideborn", "Hollis"];

// The resource a need maps to, with a flavorful naming, mirroring the brief's examples (a clam bed
// provides hunger; a hearth provides rest; a tavern provides recreation).
const RESOURCE_FLAVOR = {
  "need:hunger": ["a clam bed", "a berry thicket", "a fishing weir", "a root cellar", "a snare line"],
  "need:rest": ["a hearth", "a mossy hollow", "a thatched shelter", "a windbreak", "a warm spring"],
  "need:recreation": ["a tavern", "a meeting green", "a song circle", "a dicing den", "a bathing pool"],
};

export default async function generate({ root, seed = 1, regions = 5, areasPerRegion = 8, npcs = 16, t }) {
  if (!root) throw new TypeError("worldgen: root is required");
  if (!Number.isInteger(seed)) throw new TypeError("worldgen: seed must be an integer");
  for (const [k, v] of [["regions", regions], ["areasPerRegion", areasPerRegion], ["npcs", npcs]]) {
    if (!Number.isInteger(v) || v < 1) throw new TypeError(`worldgen: ${k} must be a positive integer`);
  }

  const prefix = t ?? "gen";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;
  const say = (subject, predicate, object) => doing({ root, subject, predicate, object, t: stamp() });

  const regionIds = [];
  const areaIds = [];
  const npcIds = [];
  const resourceIds = [];
  const itemIds = [];

  // areasPerRegion areas in a near-square grid: cols × rows covering at least areasPerRegion.
  const cols = Math.max(1, Math.round(Math.sqrt(areasPerRegion)));
  const rows = Math.ceil(areasPerRegion / cols);

  const areaId = (r, i) => `area-r${r}-a${i}`;
  const regionId = (r) => `region-${r}`;
  // The gateway is the grid's first cell (row 0, col 0 ⇒ local index 0): region-to-region links.
  const gatewayOf = (r) => areaId(r, 0);

  // areas-by-region, so we can scatter resources per region and place npcs per area.
  const regionAreas = [];

  // --- regions & their area grids --------------------------------------------------------------
  for (let r = 0; r < regions; r += 1) {
    const rid = regionId(r);
    regionIds.push(rid);
    // A region's biome is the modal flavor of its cluster — pick one biome to anchor the region.
    const regionBiome = pick(BIOMES, draw(seed, r, "region-biome"));
    await say(rid, "kind", "region");
    await say(rid, "naming", nameRegion(seed, r));
    await say(rid, "biome", regionBiome);

    const mine = [];
    for (let i = 0; i < areasPerRegion; i += 1) {
      const aid = areaId(r, i);
      areaIds.push(aid);
      mine.push(aid);
      // Each area's biome is the region's biome most of the time, with deterministic variety so a
      // region reads as a place yet isn't monotone.
      const vary = draw(seed, r * 1000 + i, "area-biome") % 4 === 0;
      const biome = vary ? pick(BIOMES, draw(seed, r * 1000 + i, "area-biome2")) : regionBiome;
      await say(aid, "kind", "area");
      await say(aid, "naming", nameArea(seed, r * 1000 + i, biome));
      await say(aid, "biome", biome);
      await say(aid, "region", rid);
      // Region owns the area (relational; dual-filed at the area anchor too).
      await say(rid, "contains", aid);
    }
    regionAreas.push(mine);

    // Wire the grid: exit-east/west across columns, exit-north/south across rows. BOTH directions
    // (the convention requires a walkable map). Local index i = row*cols + col.
    for (let i = 0; i < areasPerRegion; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const here = areaId(r, i);
      const east = i + 1;
      if (col + 1 < cols && east < areasPerRegion) {
        const there = areaId(r, east);
        await say(here, "exit-east", there);
        await say(there, "exit-west", here);
      }
      const south = i + cols;
      if (row + 1 < rows && south < areasPerRegion) {
        const there = areaId(r, south);
        await say(here, "exit-south", there);
        await say(there, "exit-north", here);
      }
    }
  }

  // --- stitch regions into a ring: gateway r --north--> gateway r+1 (and back). With regions>1
  // this makes the whole map one connected component; the ring also closes (last→first). ---------
  if (regions > 1) {
    for (let r = 0; r < regions; r += 1) {
      const nxt = (r + 1) % regions;
      const a = gatewayOf(r);
      const b = gatewayOf(nxt);
      // The grid gateway (i=0, row 0, col 0) has an east neighbor (i=1) and a south neighbor
      // (i=cols) but NO north and NO west neighbor inside its region — so exit-north and exit-west
      // are FREE there and cannot clobber an intra-region exit. Stitch the ring on that free pair:
      // a's north → b, and b's west → a (a's matching west, b's matching north stay free for the
      // ring edges that land on them). Each gateway is the target of exactly one north and one
      // west across the whole ring, so no direction is ever written twice on one area.
      await say(a, "exit-north", b);
      await say(b, "exit-west", a);
    }
  }

  // --- resources: every region gets ≥1 of EACH need type, then extras scattered ----------------
  let resCount = 0;
  for (let r = 0; r < regions; r += 1) {
    const mine = regionAreas[r];
    for (let n = 0; n < NEED_KINDS.length; n += 1) {
      const need = NEED_KINDS[n];
      const aIdx = draw(seed, r * 100 + n, "res-area") % mine.length;
      const here = mine[aIdx];
      const rid = `resource-${resCount}`;
      resCount += 1;
      resourceIds.push(rid);
      const flavor = pick(RESOURCE_FLAVOR[need], draw(seed, r * 100 + n, "res-name"));
      const amount = 1 + (draw(seed, r * 100 + n, "res-amount") % 20); // 1..20
      await say(rid, "kind", "resource");
      await say(rid, "naming", flavor);
      await say(rid, "provides", need);
      await say(rid, "located-in", here);
      await say(rid, "amount", amount);
    }
    // One extra resource per region for variety/density (need chosen by hash).
    {
      const need = pick(NEED_KINDS, draw(seed, r, "res-extra-need"));
      const aIdx = draw(seed, r, "res-extra-area") % mine.length;
      const here = mine[aIdx];
      const rid = `resource-${resCount}`;
      resCount += 1;
      resourceIds.push(rid);
      const flavor = pick(RESOURCE_FLAVOR[need], draw(seed, r, "res-extra-name"));
      const amount = 1 + (draw(seed, r, "res-extra-amount") % 20);
      await say(rid, "kind", "resource");
      await say(rid, "naming", flavor);
      await say(rid, "provides", need);
      await say(rid, "located-in", here);
      await say(rid, "amount", amount);
    }
  }

  // --- items: roughly one per two areas, with material+quality, scattered across the map --------
  const itemCount = Math.max(regions * 4, Math.ceil(areaIds.length / 2));
  for (let n = 0; n < itemCount; n += 1) {
    const iid = `item-${n}`;
    itemIds.push(iid);
    const here = areaIds[draw(seed, n, "item-area") % areaIds.length];
    const material = pick(MATERIALS, draw(seed, n, "item-material"));
    const quality = draw(seed, n, "item-quality") % 101; // 0..100
    const adj = pick(["worn", "fine", "plain", "sturdy", "cracked", "polished"], draw(seed, n, "item-adj"));
    const noun = pick({
      wood: ["plank", "haft", "stool", "bowl"],
      iron: ["nail", "blade", "hook", "pot"],
      stone: ["whetstone", "block", "mortar", "anvil"],
      cloth: ["sack", "cloak", "sail", "bandage"],
      fish: ["fillet", "salted cod", "smoked eel", "roe"],
    }[material], draw(seed, n, "item-noun"));
    await say(iid, "kind", "item");
    await say(iid, "naming", `a ${adj} ${noun}`);
    await say(iid, "material", material);
    await say(iid, "quality", quality);
    await say(iid, "located-in", here);
  }

  // --- npcs: deterministic traits/needs/skills/home, spread evenly across areas -----------------
  for (let n = 0; n < npcs; n += 1) {
    const nid = `npc-${n}`;
    npcIds.push(nid);
    // Spread homes round-robin across areas, perturbed by hash so it isn't a strict stripe.
    const homeIdx = (n + (draw(seed, n, "npc-home") % areaIds.length)) % areaIds.length;
    const home = areaIds[homeIdx];
    const first = pick(FIRST_NAMES, draw(seed, n, "npc-first"));
    const last = pick(LAST_NAMES, draw(seed, n, "npc-last"));
    await say(nid, "kind", "npc");
    await say(nid, "mover", "tick");
    await say(nid, "naming", `${first} ${last}`);
    await say(nid, "located-in", home);
    await say(nid, "home", home);

    // 1-2 distinct traits.
    const t1 = pick(TRAITS, draw(seed, n, "npc-trait1"));
    await say(nid, "trait", t1);
    if (draw(seed, n, "npc-trait-count") % 2 === 0) {
      let t2 = pick(TRAITS, draw(seed, n, "npc-trait2"));
      if (t2 === t1) t2 = pick(TRAITS, draw(seed, n, "npc-trait2") + 1);
      if (t2 !== t1) await say(nid, "trait", t2);
    }

    // Needs: integers in 60..90 (start satisfied), one cell per need kind.
    for (let k = 0; k < NEED_KINDS.length; k += 1) {
      const val = 60 + (draw(seed, n * 10 + k, "npc-need") % 31); // 60..90
      await say(nid, NEED_KINDS[k], val);
    }

    // 1-2 distinct skills, practiced.
    const s1 = pick(SKILLS, draw(seed, n, "npc-skill1"));
    await say(nid, `skill:${s1}`, "practiced");
    if (draw(seed, n, "npc-skill-count") % 2 === 0) {
      let s2 = pick(SKILLS, draw(seed, n, "npc-skill2"));
      if (s2 === s1) s2 = pick(SKILLS, draw(seed, n, "npc-skill2") + 1);
      if (s2 !== s1) await say(nid, `skill:${s2}`, "practiced");
    }
  }

  return { areas: areaIds, regions: regionIds, npcs: npcIds, resources: resourceIds, items: itemIds };
}

// CLI: node worldgen.mjs <world> [seed] [regions] [areasPerRegion] [npcs]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , world, seed, regions, areasPerRegion, npcs] = process.argv;
  if (!world) {
    console.error("usage: node worldgen.mjs <world> [seed] [regions] [areasPerRegion] [npcs]");
    process.exit(2);
  }
  const opts = { root: world };
  if (seed !== undefined) opts.seed = Number(seed);
  if (regions !== undefined) opts.regions = Number(regions);
  if (areasPerRegion !== undefined) opts.areasPerRegion = Number(areasPerRegion);
  if (npcs !== undefined) opts.npcs = Number(npcs);
  const out = await generate(opts);
  console.log(JSON.stringify({
    areas: out.areas.length, regions: out.regions.length, npcs: out.npcs.length,
    resources: out.resources.length, items: out.items.length,
  }, null, 2));
}
