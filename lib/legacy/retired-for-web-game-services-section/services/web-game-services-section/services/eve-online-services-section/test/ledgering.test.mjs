import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeTransaction,
  toBeancount,
  toHledger,
  extractIds,
  dedupeAgainst,
  LedgerError,
} from "../src/ledgering/ledger.mjs";

// The bounty transaction below reproduces, field for field, the worked
// example in content/text/documents/articles/notes/2026/08/05/
// 2026-08-05-note-on-eve-ledger-export-conventions.md so the Beancount
// output can be asserted against that note's literal text.
function bountyTransaction() {
  return makeTransaction({
    date: "2026-08-01",
    payee: "CONCORD",
    narration: "Bounty Prizes",
    metadata: {
      id: "34772918001",
      "esi-path": "/characters/2118406090/wallet/journal/",
      "esi-recorded-at": "2026-08-01T14:03:11Z",
      character: "Sennhauser",
      "ref-type": "bounty_prizes",
    },
    postings: [
      { account: "Income:Eve:Sennhauser:BountyPrizes", amount: -1250000, commodity: "ISK" },
      { account: "Assets:Eve:Sennhauser:Wallet", amount: 1250000, commodity: "ISK" },
    ],
  });
}

// A market-transaction example (not given verbatim in the note, which only
// worked the bounty case) applying the same house mapping: ref-type
// "market_transaction" -> account segment "MarketTransaction" /
// narration "Market Transaction"; buying reduces the wallet and posts an
// Expense, per the note's sign convention ("Expenses positive on spend,
// wallet negative").
function marketTransaction() {
  return makeTransaction({
    date: "2026-08-02",
    payee: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
    narration: "Market Transaction",
    metadata: {
      id: "34772918050",
      "esi-path": "/characters/2118406090/wallet/journal/",
      "esi-recorded-at": "2026-08-02T09:15:42Z",
      character: "Sennhauser",
      "ref-type": "market_transaction",
      "first-party-id": "2118406090",
      "second-party-id": "60003760",
    },
    postings: [
      { account: "Expenses:Eve:Sennhauser:MarketTransaction", amount: 2500000, commodity: "ISK" },
      { account: "Assets:Eve:Sennhauser:Wallet", amount: -2500000, commodity: "ISK" },
    ],
  });
}

// --- makeTransaction validation -------------------------------------------

test("makeTransaction accepts a balanced two-posting transaction", () => {
  const tx = bountyTransaction();
  assert.equal(tx.date, "2026-08-01");
  assert.equal(tx.payee, "CONCORD");
  assert.equal(tx.narration, "Bounty Prizes");
  assert.equal(tx.postings.length, 2);
  assert.ok(Object.isFrozen(tx));
  assert.ok(Object.isFrozen(tx.postings));
  assert.ok(Object.isFrozen(tx.postings[0]));
});

test("makeTransaction rejects postings that do not sum to zero", () => {
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "Imbalanced",
        postings: [
          { account: "Income:Eve:Sennhauser:BountyPrizes", amount: -1000, commodity: "ISK" },
          { account: "Assets:Eve:Sennhauser:Wallet", amount: 999, commodity: "ISK" },
        ],
      }),
    (err) => err instanceof LedgerError && err.code === "unbalanced_transaction",
  );
});

test("makeTransaction accepts an imbalance within the 1e-6 float tolerance", () => {
  const tx = makeTransaction({
    date: "2026-08-01",
    narration: "Float noise",
    postings: [
      { account: "Assets:Eve:Sennhauser:Wallet", amount: 0.1 + 0.2, commodity: "ISK" },
      { account: "Income:Eve:Sennhauser:BountyPrizes", amount: -0.3, commodity: "ISK" },
    ],
  });
  assert.equal(tx.postings.length, 2);
});

test("makeTransaction supports multi-commodity transactions, balanced per commodity", () => {
  // Deliberately EVE-agnostic accounts/commodities: this module must not
  // care what "ISK" or "Eve" mean, only that each commodity group sums to 0.
  const tx = makeTransaction({
    date: "2026-08-01",
    narration: "Payday with comp time",
    postings: [
      { account: "Assets:Checking", amount: 500, commodity: "USD" },
      { account: "Income:Salary", amount: -500, commodity: "USD" },
      { account: "Assets:VacationBank", amount: 8, commodity: "HOURS" },
      { account: "Income:AccruedTime", amount: -8, commodity: "HOURS" },
    ],
  });
  assert.equal(tx.postings.length, 4);
});

test("makeTransaction rejects a multi-commodity transaction unbalanced in only one commodity", () => {
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "Broken in one leg",
        postings: [
          { account: "Assets:Checking", amount: 500, commodity: "USD" },
          { account: "Income:Salary", amount: -500, commodity: "USD" },
          { account: "Assets:VacationBank", amount: 8, commodity: "HOURS" },
          { account: "Income:AccruedTime", amount: -7, commodity: "HOURS" },
        ],
      }),
    (err) => err instanceof LedgerError && err.code === "unbalanced_transaction",
  );
});

test("makeTransaction requires at least 2 postings", () => {
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "Solo",
        postings: [{ account: "Assets:Checking", amount: 0, commodity: "USD" }],
      }),
    (err) => err instanceof LedgerError && err.code === "too_few_postings",
  );
});

test("makeTransaction rejects account names that are not PascalCase colon-joined", () => {
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "Bad account",
        postings: [
          { account: "assets:checking", amount: 1, commodity: "USD" },
          { account: "Income:Salary", amount: -1, commodity: "USD" },
        ],
      }),
    (err) => err instanceof LedgerError && err.code === "invalid_account",
  );
});

test("makeTransaction rejects a malformed or unreal date", () => {
  assert.throws(
    () => makeTransaction({ date: "2026/08/01", narration: "x", postings: [] }),
    TypeError,
  );
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-02-30",
        narration: "x",
        postings: [
          { account: "Assets:Checking", amount: 1, commodity: "USD" },
          { account: "Income:Salary", amount: -1, commodity: "USD" },
        ],
      }),
    (err) => err instanceof LedgerError && err.code === "invalid_date",
  );
});

test("makeTransaction rejects non-string metadata values", () => {
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "x",
        metadata: { id: 123 },
        postings: [
          { account: "Assets:Checking", amount: 1, commodity: "USD" },
          { account: "Income:Salary", amount: -1, commodity: "USD" },
        ],
      }),
    TypeError,
  );
});

test("makeTransaction requires narration and rejects an empty payee", () => {
  assert.throws(
    () => makeTransaction({ date: "2026-08-01", postings: [] }),
    TypeError,
  );
  assert.throws(
    () =>
      makeTransaction({
        date: "2026-08-01",
        narration: "x",
        payee: "",
        postings: [
          { account: "Assets:Checking", amount: 1, commodity: "USD" },
          { account: "Income:Salary", amount: -1, commodity: "USD" },
        ],
      }),
    TypeError,
  );
});

// --- toBeancount ------------------------------------------------------------

test("toBeancount reproduces the bounty example from the ledger-conventions note verbatim", () => {
  const expected =
    '2026-08-01 * "CONCORD" "Bounty Prizes"\n' +
    '  id: "34772918001"\n' +
    '  esi-path: "/characters/2118406090/wallet/journal/"\n' +
    '  esi-recorded-at: "2026-08-01T14:03:11Z"\n' +
    '  character: "Sennhauser"\n' +
    '  ref-type: "bounty_prizes"\n' +
    "  Income:Eve:Sennhauser:BountyPrizes    -1250000.00 ISK\n" +
    "  Assets:Eve:Sennhauser:Wallet           1250000.00 ISK\n";
  assert.equal(toBeancount([bountyTransaction()]), expected);
});

test("toBeancount renders a market transaction with the same posting-alignment rule", () => {
  const expected =
    '2026-08-02 * "Jita IV - Moon 4 - Caldari Navy Assembly Plant" "Market Transaction"\n' +
    '  id: "34772918050"\n' +
    '  esi-path: "/characters/2118406090/wallet/journal/"\n' +
    '  esi-recorded-at: "2026-08-02T09:15:42Z"\n' +
    '  character: "Sennhauser"\n' +
    '  ref-type: "market_transaction"\n' +
    '  first-party-id: "2118406090"\n' +
    '  second-party-id: "60003760"\n' +
    "  Expenses:Eve:Sennhauser:MarketTransaction    2500000.00 ISK\n" +
    "  Assets:Eve:Sennhauser:Wallet                -2500000.00 ISK\n";
  assert.equal(toBeancount([marketTransaction()]), expected);
});

test("toBeancount renders a full file: options, commodity decl, account opens, both transactions", () => {
  const expected =
    'option "title" "Sennhauser EVE Wallet"\n' +
    'option "operating_currency" "ISK"\n' +
    "\n" +
    "2026-01-01 commodity ISK\n" +
    '  name: "InterStellar Kredits"\n' +
    '  asset-class: "currency"\n' +
    "\n" +
    "2026-01-01 open Assets:Eve:Sennhauser:Wallet ISK\n" +
    "2026-01-01 open Income:Eve:Sennhauser:BountyPrizes ISK\n" +
    "2026-01-01 open Expenses:Eve:Sennhauser:MarketTransaction ISK\n" +
    "\n" +
    '2026-08-01 * "CONCORD" "Bounty Prizes"\n' +
    '  id: "34772918001"\n' +
    '  esi-path: "/characters/2118406090/wallet/journal/"\n' +
    '  esi-recorded-at: "2026-08-01T14:03:11Z"\n' +
    '  character: "Sennhauser"\n' +
    '  ref-type: "bounty_prizes"\n' +
    "  Income:Eve:Sennhauser:BountyPrizes    -1250000.00 ISK\n" +
    "  Assets:Eve:Sennhauser:Wallet           1250000.00 ISK\n" +
    "\n" +
    '2026-08-02 * "Jita IV - Moon 4 - Caldari Navy Assembly Plant" "Market Transaction"\n' +
    '  id: "34772918050"\n' +
    '  esi-path: "/characters/2118406090/wallet/journal/"\n' +
    '  esi-recorded-at: "2026-08-02T09:15:42Z"\n' +
    '  character: "Sennhauser"\n' +
    '  ref-type: "market_transaction"\n' +
    '  first-party-id: "2118406090"\n' +
    '  second-party-id: "60003760"\n' +
    "  Expenses:Eve:Sennhauser:MarketTransaction    2500000.00 ISK\n" +
    "  Assets:Eve:Sennhauser:Wallet                -2500000.00 ISK\n";

  const out = toBeancount([bountyTransaction(), marketTransaction()], {
    title: "Sennhauser EVE Wallet",
    operatingCurrency: "ISK",
    commodityDecls: [{ date: "2026-01-01", commodity: "ISK", name: "InterStellar Kredits", assetClass: "currency" }],
    accountOpens: [
      { date: "2026-01-01", account: "Assets:Eve:Sennhauser:Wallet", commodity: "ISK" },
      { date: "2026-01-01", account: "Income:Eve:Sennhauser:BountyPrizes", commodity: "ISK" },
      { date: "2026-01-01", account: "Expenses:Eve:Sennhauser:MarketTransaction", commodity: "ISK" },
    ],
  });
  assert.equal(out, expected);
});

test("toBeancount returns the empty string for no transactions and no options", () => {
  assert.equal(toBeancount([]), "");
});

test("toBeancount rejects a transaction not built by makeTransaction", () => {
  assert.throws(() => toBeancount([{ date: "2026-08-01" }]), TypeError);
});

// --- toHledger --------------------------------------------------------------

test("toHledger renders the bounty transaction with slash dates and a tag comment", () => {
  const expected =
    "2026/08/01 CONCORD | Bounty Prizes ; id:34772918001, esi-path:/characters/2118406090/wallet/journal/, " +
    "esi-recorded-at:2026-08-01T14:03:11Z, character:Sennhauser, ref-type:bounty_prizes\n" +
    "    Income:Eve:Sennhauser:BountyPrizes    -1250000.00 ISK\n" +
    "    Assets:Eve:Sennhauser:Wallet           1250000.00 ISK\n";
  assert.equal(toHledger([bountyTransaction()]), expected);
});

test("toHledger renders the market transaction and honors accountDecls", () => {
  const expected =
    "account Assets:Eve:Sennhauser:Wallet\n" +
    "account Expenses:Eve:Sennhauser:MarketTransaction\n" +
    "\n" +
    "2026/08/02 Jita IV - Moon 4 - Caldari Navy Assembly Plant | Market Transaction ; id:34772918050, " +
    "esi-path:/characters/2118406090/wallet/journal/, esi-recorded-at:2026-08-02T09:15:42Z, " +
    "character:Sennhauser, ref-type:market_transaction, first-party-id:2118406090, second-party-id:60003760\n" +
    "    Expenses:Eve:Sennhauser:MarketTransaction    2500000.00 ISK\n" +
    "    Assets:Eve:Sennhauser:Wallet                -2500000.00 ISK\n";
  const out = toHledger([marketTransaction()], {
    accountDecls: ["Assets:Eve:Sennhauser:Wallet", "Expenses:Eve:Sennhauser:MarketTransaction"],
  });
  assert.equal(out, expected);
});

test("toHledger omits the payee separator when no payee is given", () => {
  const tx = makeTransaction({
    date: "2026-08-03",
    narration: "Skill point injection",
    postings: [
      { account: "Assets:Eve:Sennhauser:Wallet", amount: -500, commodity: "ISK" },
      { account: "Expenses:Eve:Sennhauser:SkillTraining", amount: 500, commodity: "ISK" },
    ],
  });
  const out = toHledger([tx]);
  assert.ok(out.startsWith("2026/08/03 Skill point injection\n"));
});

test("toHledger returns the empty string for no transactions and no options", () => {
  assert.equal(toHledger([]), "");
});

// A player-supplied wallet-journal "reason" (or any other free-text
// metadata value) can contain characters that would otherwise corrupt
// hledger's single-line transaction format: a newline would splice extra,
// unrelated-looking lines into the exported journal, and a comma would
// inject an extra tag (including a forged "id:" that could poison a later
// dedupeAgainst call). Both must render as inert text, never as structure.
test("toHledger neutralizes newlines and commas in narration/payee/metadata so the output stays one line", () => {
  const tx = makeTransaction({
    date: "2026-08-04",
    payee: "Evil\nCorp, Ltd",
    narration: "Donation\nreceived, thanks",
    metadata: {
      id: "1",
      reason: "gg\n2026/08/05 Fake Transaction\n    Assets:Hacker  1000000.00 ISK\n    Income:Fraud  -1000000.00 ISK",
    },
    postings: [
      { account: "Assets:Eve:Sennhauser:Wallet", amount: 1, commodity: "ISK" },
      { account: "Income:Eve:Sennhauser:Donation", amount: -1, commodity: "ISK" },
    ],
  });
  const out = toHledger([tx]);
  const lines = out.split("\n").filter((line) => line.length > 0);
  // Header + 2 posting lines only -- no injected lines from the reason field:
  // the embedded "fake transaction" text survives only as inert text inside
  // the header line's tag comment, never as lines of its own.
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("2026/08/04 "));
  assert.ok(lines[0].includes("Fake Transaction")); // present, but as harmless text
  assert.ok(!lines.some((line) => line.trim().startsWith("Assets:Hacker"))); // never its own posting line
});

test("toHledger does not let a comma in a metadata value forge an extra id: tag", () => {
  const tx = makeTransaction({
    date: "2026-08-04",
    narration: "Suspicious donation",
    metadata: { id: "1", reason: "for the fleet, id:999999999" },
    postings: [
      { account: "Assets:Eve:Sennhauser:Wallet", amount: 1, commodity: "ISK" },
      { account: "Income:Eve:Sennhauser:Donation", amount: -1, commodity: "ISK" },
    ],
  });
  const out = toHledger([tx]);
  const ids = extractIds(out, "hledger");
  assert.deepEqual([...ids], ["1"]);
});

// --- extractIds ---------------------------------------------------------

test("extractIds finds ids in a Beancount ledger", () => {
  const text = toBeancount([bountyTransaction(), marketTransaction()]);
  const ids = extractIds(text, "beancount");
  assert.deepEqual([...ids].sort(), ["34772918001", "34772918050"]);
});

test("extractIds finds ids in an hledger journal", () => {
  const text = toHledger([bountyTransaction(), marketTransaction()]);
  const ids = extractIds(text, "hledger");
  assert.deepEqual([...ids].sort(), ["34772918001", "34772918050"]);
});

test("extractIds returns an empty set when there is nothing to find", () => {
  assert.deepEqual(extractIds("", "beancount"), new Set());
  assert.deepEqual(extractIds("2026/08/01 no tags here\n    A  1.00 ISK\n", "hledger"), new Set());
});

test("extractIds rejects an unknown format", () => {
  assert.throws(() => extractIds("", "ledger-cli"), TypeError);
});

// --- dedupeAgainst --------------------------------------------------------

test("dedupeAgainst (beancount) skips a transaction whose id is already recorded", () => {
  const existingText = toBeancount([bountyTransaction()]);
  const kept = dedupeAgainst(existingText, "beancount", [bountyTransaction(), marketTransaction()]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].metadata.id, "34772918050");
});

test("dedupeAgainst (hledger) skips a transaction whose id is already recorded", () => {
  const existingText = toHledger([bountyTransaction()]);
  const kept = dedupeAgainst(existingText, "hledger", [bountyTransaction(), marketTransaction()]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].metadata.id, "34772918050");
});

test("dedupeAgainst keeps everything when the ledger text has no matching ids yet", () => {
  const kept = dedupeAgainst("", "beancount", [bountyTransaction(), marketTransaction()]);
  assert.equal(kept.length, 2);
});

test("dedupeAgainst throws when a transaction has no metadata.id", () => {
  const tx = makeTransaction({
    date: "2026-08-01",
    narration: "No id",
    postings: [
      { account: "Assets:Checking", amount: 1, commodity: "USD" },
      { account: "Income:Salary", amount: -1, commodity: "USD" },
    ],
  });
  assert.throws(
    () => dedupeAgainst("", "beancount", [tx]),
    (err) => err instanceof LedgerError && err.code === "missing_id",
  );
});
