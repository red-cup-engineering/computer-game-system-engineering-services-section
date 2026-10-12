// trade — fiber exchange. When two entities trade, possession moves between fibers. A leg of a
// trade is one `located-in` move on the item to its new holder: because `located-in` is FUNCTIONAL
// it SUPERSEDES the item's prior place (the giver's latest located-in no longer names them), and
// because it is RELATIONAL it is DUAL-FILED at the holder anchor (the holder's log gains the item
// as contents). That dual filing IS the double-entry the economy wants — my inventory debits the
// item, yours credits it — with no ledger object and no mutation of history. The accounting IS the
// EAVT. A two-legged trade records both moves together; a one-sided GIFT is a trade with only a give.
//
// `trading/` nests inside `changing/` because each leg is the existing functional `located-in`
// change. Per-leg `t` is derived deterministically from the passed `t` (`${t}/a`, `${t}/b`) so the
// two legs order stably under replay. Sketched in docs/dev/notes/economy-is-predicate-richness.md.
//
// trade({ root, t, give, take }) -> { legs:[row(,row)], richnessBefore, richnessAfter }
//   give : { item, to }   move `item` to holder `to` (attributed to `to` as the acquiring agent)
//   take : { item, to }   the reciprocal leg (optional — omit for a one-sided gift)
//   t    : a base time; legs get `${t}/a` and `${t}/b`.

import changing from "#changing";
import { richnessOf } from "#being/library/value/library/richness/scripts/richness.mjs";

async function leg(root, item, to, t) {
  if (!item || !to) throw new TypeError("trade: a leg needs { item, to }");
  // attributed to the acquiring holder — the agency that takes possession makes the cut.
  const { row } = await changing({ root, agent: to, subject: item, predicate: "located-in", object: to, t });
  return row;
}

export default async function trade({ root, t, give, take }) {
  if (!root || t == null) throw new TypeError("trade: root and t are required");
  if (!give && !take) throw new TypeError("trade: at least one of give/take is required");

  // The holders whose worth the swap quotes (the new acquirers on each present leg).
  const holders = [...new Set([give?.to, take?.to].filter(Boolean))];
  const quote = async () => {
    const out = {};
    for (const h of holders) out[h] = await richnessOf(root, h);
    return out;
  };

  const richnessBefore = await quote();

  const legs = [];
  if (give) legs.push(await leg(root, give.item, give.to, `${t}/a`));
  if (take) legs.push(await leg(root, take.item, take.to, `${t}/b`));

  const richnessAfter = await quote();

  return { legs, richnessBefore, richnessAfter };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, item, to] = process.argv.slice(2);
  if (!world || !item || !to) {
    console.error("usage: node trade.mjs <world> <item> <to>");
    process.exit(2);
  }
  const r = await trade({ root: world, t: `trade:${Date.now()}`, give: { item, to } });
  console.log(JSON.stringify(r, null, 2));
}
