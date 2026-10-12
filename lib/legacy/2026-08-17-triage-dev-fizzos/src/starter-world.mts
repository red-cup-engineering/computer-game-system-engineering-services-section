/**
 * `@emsenn/fizzos/starter-world` — the small world `fizzos-serve` boots when a host
 * supplies none: Fizzwater Quay, a granite spur where a carbonated spring bubbles up,
 * and the Salt Lantern taproom beside it. Enough rooms, exits, items, and an NPC to
 * exercise look / go / take / drop / give / inventory / say and the tick. Hosts wiring
 * their own content pass their own `Bible`.
 */
import type { Bible } from "./world-load.mjs";

export const STARTER_WORLD: Bible = Object.freeze({
  meta: { world: "fizzwater", playerStart: "fizzwater-quay" },
  rooms: [
    {
      id: "fizzwater-quay",
      name: "Fizzwater Quay",
      description:
        "A short spur of granite where a carbonated spring bubbles up through a crack in the stone, hissing and frothing — Fizzwater, the islanders call it. A low door with a swinging lamp leads into the Salt Lantern to the east; the open water lies north.",
      exits: { east: "the-salt-lantern", north: "the-jetty" },
      tags: ["place", "harbor", "outdoor", "node:fiber"],
    },
    {
      id: "the-salt-lantern",
      name: "The Salt Lantern",
      description:
        "A cramped one-room taproom lit by a single brass lantern and warmed against the spray. Pip Fizzle keeps it, drawing pints cut with the fizzing spring water. The quay is back out west.",
      exits: { west: "fizzwater-quay", down: "the-cellar" },
      tags: ["place", "tavern", "indoor"],
    },
    {
      id: "the-jetty",
      name: "The Jetty",
      description: "A weathered timber jetty reaching out over cold green water — the harbor's one berth deep enough to tie up a boat. The quay is south; the open water lies seaward.",
      exits: { south: "fizzwater-quay", seaward: "open-water" },
      tags: ["place", "harbor", "outdoor", "dock", "node:timber"],
    },
    {
      id: "open-water",
      name: "Open Water",
      description: "Grey swell off the harbor mouth, the island a low smudge astern. The jetty lies shoreward; the deep sea opens to the north.",
      exits: { shoreward: "the-jetty", north: "the-deep-sea" },
      tags: ["ocean"],
      partOf: "the-fizzwater-sound",
    },
    {
      id: "the-deep-sea",
      name: "The Deep Sea",
      description: "Long ocean rollers, no land in any quarter. Open water lies south; a smudge of rock breaks the swell to the east.",
      exits: { south: "open-water", east: "gull-rock" },
      tags: ["ocean", "node:fish"],
      partOf: "the-fizzwater-sound",
    },
    {
      id: "gull-rock",
      name: "Gull Rock",
      description: "A guano-streaked stack screaming with gulls, a notch of calm water in its lee. The deep sea lies west.",
      exits: { west: "the-deep-sea" },
      tags: ["ocean"],
      partOf: "the-fizzwater-sound",
    },
    {
      id: "the-cellar",
      name: "the Salt Lantern's Cellar",
      description: "A low cellar of barrels and cobwebs under the taproom, smelling of brine and old coin.",
      exits: { up: "the-salt-lantern" },
      tags: ["place", "indoor"],
    },
    {
      id: "the-fizzwater-sound",
      name: "the Fizzwater Sound",
      description: "The whole reach of grey water off the island — open water, the deep, and Gull Rock together.",
      exits: {},
      tags: ["region", "ocean"],
    },
  ],
  ships: [
    {
      id: "the-fizzwater-skiff",
      name: "the Fizzwater Skiff",
      description: "A stubby single-masted skiff, tar-black and sound, tied up at the jetty.",
      class: "skiff",
      location: "the-jetty",
      hull: 8,
      speed: 1,
      cargo: 4,
      price: 60,
      rent: 10,
      rooms: [
        {
          id: "skiff-deck",
          name: "the Skiff's Deck",
          description: "A cramped open deck of tarred planks, the single mast amidships, the tiller aft.",
          exits: { aft: "skiff-helm" },
          deck: true,
        },
        {
          id: "skiff-helm",
          name: "the Skiff's Tiller",
          description: "The aft thwart, tiller in hand — from here you can steer her out across the water.",
          exits: { forward: "skiff-deck" },
          helm: true,
        },
      ],
    },
  ],
  items: [
    { id: "a-brass-lantern", name: "a brass lantern", description: "A dented brass lantern, still bright.", location: "the-salt-lantern", tags: ["item", "takeable"] },
    { id: "a-bottle-of-fizzwater", name: "a bottle of fizzwater", description: "Spring water straight off the quay, still fizzing.", location: "fizzwater-quay", tags: ["item", "takeable"] },
    { id: "a-coil-of-rope", name: "a coil of rope", description: "Sturdy tarred hemp, sound enough to moor a boat.", location: "the-jetty", tags: ["item", "takeable"] },
    { id: "a-rusty-cutlass", name: "a rusty cutlass", description: "A pitted old cutlass, edge gone soft but still a blade.", location: "the-jetty", tags: ["item", "takeable", "weapon", "weapon-damage:3", "value:5"] },
    { id: "an-oilskin-coat", name: "an oilskin coat", description: "A stiff tarred coat that turns the spray — and a blow or two.", location: "the-salt-lantern", tags: ["item", "takeable", "armor", "armor-protection:2", "value:4"] },
    {
      id: "a-tin-notice",
      name: "a tin notice",
      description: "A weathered tin notice nailed by the quay's spring.",
      location: "fizzwater-quay",
      tags: ["fixed"],
      text: "BY ORDER OF THE HARBORMASTER: the Fizzwater spring is a public good. Bottling for sale is the sole privilege of the Salt Lantern. Mind the rats.",
    },
    {
      id: "a-sea-chest",
      name: "a sea chest",
      description: "A battered sea chest with a salt-crusted clasp, shut against the weather.",
      location: "the-jetty",
      tags: ["fixed", "container", "closed"],
    },
    { id: "a-tarnished-locket", name: "a tarnished locket", description: "A small silver locket, gone black with sea air.", location: "a-sea-chest", tags: ["item", "takeable", "value:8"] },
    { id: "a-baulk-of-timber-1", name: "a baulk of timber", description: "A squared length of seasoned oak, fit for a boat's frame.", location: "the-jetty", tags: ["item", "takeable", "timber"] },
    { id: "a-baulk-of-timber-2", name: "a baulk of timber", description: "A squared length of seasoned oak, fit for a boat's frame.", location: "the-jetty", tags: ["item", "takeable", "timber"] },
    { id: "a-baulk-of-timber-3", name: "a baulk of timber", description: "A squared length of seasoned oak, fit for a boat's frame.", location: "the-jetty", tags: ["item", "takeable", "timber"] },
    { id: "a-rusty-key", name: "a rusty iron key", description: "A heavy iron key, red with rust — it fits a cellar hatch.", location: "the-jetty", tags: ["item", "takeable", "hidden"] },
    { id: "the-cellar-hatch", name: "the cellar hatch", description: "A stout planked hatch in the taproom floor, with an iron lock.", location: "the-salt-lantern", tags: ["fixed", "door", "guards:down", "locked", "key:a-rusty-key"] },
    { id: "a-smugglers-hoard", name: "a smuggler's hoard", description: "A small chest of coin and contraband, long forgotten in the cellar.", location: "the-cellar", tags: ["item", "takeable", "value:40"] },
    { id: "a-hank-of-fiber-1", name: "a hank of hemp fiber", description: "Raw combed hemp, ready to lay into rope.", location: "fizzwater-quay", tags: ["item", "takeable", "fiber"] },
    { id: "a-hank-of-fiber-2", name: "a hank of hemp fiber", description: "Raw combed hemp, ready to lay into rope.", location: "fizzwater-quay", tags: ["item", "takeable", "fiber"] },
  ],
  npcs: [
    {
      id: "pip-fizzle",
      name: "Pip Fizzle",
      description: "The Salt Lantern's keeper: small, quick, and endlessly delighted by the fizzing spring.",
      location: "the-salt-lantern",
      tags: ["npc", "shop", "sells:fizzwater", "speaks:harbor-cant", "health:12", "attack:2", "coin:50"],
      speech: "Welcome, welcome! Try the fizzwater — straight off the quay, sharp as a slap. Nobody else sells it, you know.",
    },
    {
      id: "a-muttering-drunk",
      name: "a muttering drunk",
      description: "A sodden figure slumped against a piling, arguing with someone only he can see.",
      location: "the-jetty",
      tags: ["npc", "evasive", "routine:night:the-salt-lantern", "routine:day:the-jetty", "routine:dawn:the-jetty"],
      speech: "...and I told the gull, I told it...",
    },
    { id: "a-harbor-rat", name: "a harbor rat", description: "A wet, bristling rat the size of a cat, cornered on the jetty and spoiling for a fight.", location: "the-jetty", tags: ["npc", "hostile", "health:6", "attack:2"] },
  ],
  quests: [
    {
      id: "ropes-for-pip",
      name: "Ropes for Pip",
      description: "Pip wants the coil of rope from the jetty to hang his lanterns.",
      give: "a-coil-of-rope",
      to: "pip-fizzle",
      reward: 'Pip Fizzle beams. "The very thing! Here — a bottle on the house, and you\'re always welcome at the Lantern."',
    },
  ],
});
