/**
 * `@emsenn/fizzos/ship-classes` — the buildable hull templates.
 *
 * A class is a recipe: a cost in coin and timber, the vessel's capabilities (hull,
 * speed, cargo), and the room layout to lay down. `build <class>` at a boatyard
 * instantiates one — new ship entity, new rooms — owned by the builder. The ladder of
 * classes is the progression: a lashed raft, a one-thwart dinghy, a working skiff, a
 * coastal lugger — each fancier and more capable than the last.
 */
export interface ShipClassRoom {
  /** The room's id suffix (full id is `<shipId>-<suffix>`). */
  readonly suffix: string;
  readonly name: string;
  readonly description: string;
  /** Exits to sibling rooms, by direction → sibling suffix. */
  readonly exits?: Readonly<Record<string, string>>;
  readonly deck?: boolean;
  readonly helm?: boolean;
}

export interface ShipClass {
  readonly hull: number;
  readonly speed: number;
  readonly cargo: number;
  /** Coin to build. */
  readonly cost: number;
  /** Timber (items tagged `timber`) consumed. */
  readonly timber: number;
  readonly rooms: readonly ShipClassRoom[];
}

const oneRoom = (name: string, description: string): readonly ShipClassRoom[] =>
  [{ suffix: "deck", name, description, deck: true, helm: true }];

export const SHIP_CLASSES: Readonly<Record<string, ShipClass>> = Object.freeze({
  raft: {
    hull: 4, speed: 1, cargo: 1, cost: 15, timber: 2,
    rooms: oneRoom("the raft", "A few logs lashed with rope — barely a deck, but it floats, and it steers if you kneel and paddle."),
  },
  dinghy: {
    hull: 6, speed: 1, cargo: 2, cost: 35, timber: 3,
    rooms: oneRoom("the new dinghy", "A clinker-built dinghy fresh off the stocks, smelling of pitch. The whole boat is the helm."),
  },
  skiff: {
    hull: 8, speed: 1, cargo: 4, cost: 60, timber: 5,
    rooms: [
      { suffix: "deck", name: "the skiff's deck", description: "A trim single-masted deck of new planking, the tiller aft.", exits: { aft: "helm" }, deck: true },
      { suffix: "helm", name: "the skiff's tiller", description: "The aft thwart, tiller in hand.", exits: { forward: "deck" }, helm: true },
    ],
  },
  station: {
    hull: 24, speed: 0, cargo: 20, cost: 120, timber: 10,
    rooms: [
      // A fixed offshore platform — no helm, so she never sails. Built ON the water,
      // never ashore: industry and its structures belong to the sea, not to Farstone.
      { suffix: "deck", name: "the sea-station's platform", description: "A timber platform pinned to the seabed on tarred piles, derricks and winches crowding the deck. The only way off is into a boat.", deck: true },
    ],
  },
  lugger: {
    hull: 18, speed: 2, cargo: 12, cost: 240, timber: 14,
    rooms: [
      { suffix: "deck", name: "the lugger's deck", description: "A broad new working deck, hatch forward, wheel aft.", exits: { aft: "wheel", below: "hold" }, deck: true },
      { suffix: "wheel", name: "the lugger's wheel", description: "The helm aft; she answers from here.", exits: { forward: "deck" }, helm: true },
      { suffix: "hold", name: "the lugger's hold", description: "A dry dark hold, room for a real load.", exits: { above: "deck" } },
    ],
  },
});
