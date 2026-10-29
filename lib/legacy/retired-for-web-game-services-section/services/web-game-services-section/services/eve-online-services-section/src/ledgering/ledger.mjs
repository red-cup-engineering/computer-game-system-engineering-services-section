// src/ledgering/ledger.mjs
//
// Generic double-entry ledger engine: validated transaction construction plus
// Beancount and hledger plain-text serializers. Deliberately domain-agnostic
// -- nothing here knows what EVE Online, a character, or a ref-type is. The
// EVE wallet-journal -> ledger mapping (account naming, ref-type -> narration
// etc.) lives in src/records/ and app wiring, not here. See README.md for
// the extraction note and the serialization choices this file encodes.
//
// Zero dependencies; only language builtins are used (no Web APIs needed
// either), so this module is trivially portable to Node, Workers, or a
// future standalone @red-cup-engineering/ledgering package.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Accounts are PascalCase segments joined by colons, e.g.
// "Assets:Eve:Sennhauser:Wallet". This is a generic bookkeeping convention
// (mirrors Beancount's own account-name rules), not an EVE-specific choice --
// EVE character names, ref-types etc. are sanitized into this shape by the
// caller before reaching this module.
const ACCOUNT_RE = /^[A-Z][A-Za-z0-9]*(?::[A-Z][A-Za-z0-9]*)*$/;

// Commodities are uppercase codes (ISK, USD, HOURS, TOKENS, ...).
const COMMODITY_RE = /^[A-Z][A-Z0-9]*$/;

// Postings in the same commodity must net to zero; tolerance absorbs
// floating-point summation error, not real imbalance.
const BALANCE_TOLERANCE = 1e-6;

// Minimum gap (spaces) between the end of an account name (plus one column
// for a leading "-" if the amount is negative) and the first digit of the
// rendered amount. Chosen to reproduce the alignment in the worked example
// in content/text/documents/articles/notes/2026/08/05/
// 2026-08-05-note-on-eve-ledger-export-conventions.md, where both postings'
// amounts start their digits in the same column regardless of sign -- see
// README.md "Posting alignment" for the derivation.
const POSTING_GAP = 4;

/**
 * Thrown for ledger-domain validation failures (unbalanced transaction, bad
 * account/commodity/date shape, missing dedup id). `code` is a stable,
 * greppable identifier callers can branch on. Plain shape/type mistakes
 * (wrong JS type, missing required field) throw TypeError instead.
 */
export class LedgerError extends Error {
  constructor(message, code) {
    if (typeof code !== "string" || code.length === 0) {
      throw new TypeError("LedgerError requires a non-empty string code");
    }
    super(message);
    this.name = "LedgerError";
    this.code = code;
  }
}

function assertRealCalendarDate(date, label) {
  const [year, month, day] = date.split("-").map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    asDate.getUTCFullYear() === year && asDate.getUTCMonth() === month - 1 && asDate.getUTCDate() === day;
  if (!isReal) {
    throw new LedgerError(`${label}: "${date}" is not a real calendar date`, "invalid_date");
  }
}

function validateMetadata(metadata, label) {
  if (metadata === undefined || metadata === null) return Object.freeze({});
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError(`${label}: metadata must be a flat object of string values`);
  }
  const normalized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string") {
      throw new TypeError(`${label}: metadata["${key}"] must be a string, got ${typeof value}`);
    }
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

function validatePosting(posting, index) {
  if (typeof posting !== "object" || posting === null) {
    throw new TypeError(`makeTransaction: postings[${index}] must be an object`);
  }
  const { account, amount, commodity } = posting;
  if (typeof account !== "string" || account.length === 0) {
    throw new TypeError(`makeTransaction: postings[${index}].account must be a non-empty string`);
  }
  if (!ACCOUNT_RE.test(account)) {
    throw new LedgerError(
      `makeTransaction: postings[${index}].account "${account}" is not PascalCase colon-joined ` +
        '(e.g. "Assets:Eve:Sennhauser:Wallet")',
      "invalid_account",
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new TypeError(`makeTransaction: postings[${index}].amount must be a finite number`);
  }
  if (typeof commodity !== "string" || !COMMODITY_RE.test(commodity)) {
    throw new LedgerError(
      `makeTransaction: postings[${index}].commodity "${commodity}" must be an uppercase code (e.g. "ISK")`,
      "invalid_commodity",
    );
  }
  return Object.freeze({ account, amount, commodity });
}

/**
 * Build and validate a double-entry transaction. Postings must number at
 * least 2 and, grouped by commodity, each group must sum to 0 within
 * BALANCE_TOLERANCE. Returns a frozen, normalized transaction object; throws
 * TypeError for shape/type mistakes and LedgerError for domain violations
 * (bad date, bad account/commodity form, imbalance, too few postings).
 */
export function makeTransaction({ date, payee, narration, metadata, postings } = {}) {
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new TypeError('makeTransaction: date must be a "YYYY-MM-DD" string');
  }
  assertRealCalendarDate(date, "makeTransaction");

  if (payee !== undefined && payee !== null) {
    if (typeof payee !== "string" || payee.length === 0) {
      throw new TypeError("makeTransaction: payee, when given, must be a non-empty string");
    }
  }
  if (typeof narration !== "string" || narration.length === 0) {
    throw new TypeError("makeTransaction: narration must be a non-empty string");
  }

  const normalizedMetadata = validateMetadata(metadata, "makeTransaction");

  if (!Array.isArray(postings) || postings.length < 2) {
    throw new LedgerError(
      `makeTransaction: postings must be an array of at least 2 entries, got ${
        Array.isArray(postings) ? postings.length : typeof postings
      }`,
      "too_few_postings",
    );
  }
  const normalizedPostings = postings.map((posting, index) => validatePosting(posting, index));

  const totalsByCommodity = new Map();
  for (const posting of normalizedPostings) {
    totalsByCommodity.set(posting.commodity, (totalsByCommodity.get(posting.commodity) ?? 0) + posting.amount);
  }
  for (const [commodity, total] of totalsByCommodity) {
    if (Math.abs(total) > BALANCE_TOLERANCE) {
      throw new LedgerError(
        `makeTransaction: postings in commodity "${commodity}" sum to ${total}, must be within ` +
          `${BALANCE_TOLERANCE} of 0`,
        "unbalanced_transaction",
      );
    }
  }

  return Object.freeze({
    date,
    payee: payee ?? null,
    narration,
    metadata: normalizedMetadata,
    postings: Object.freeze(normalizedPostings),
  });
}

function assertTransactionShape(tx, index, fnName) {
  if (
    typeof tx !== "object" ||
    tx === null ||
    typeof tx.date !== "string" ||
    typeof tx.narration !== "string" ||
    typeof tx.metadata !== "object" ||
    tx.metadata === null ||
    !Array.isArray(tx.postings)
  ) {
    throw new TypeError(`${fnName}: transactions[${index}] is not a valid transaction (build it with makeTransaction)`);
  }
}

// Beancount and hledger amounts both render as "<sign?><digits>.<2dp>
// <COMMODITY>" (no currency symbol prefix -- both formats treat commodity as
// a trailing bare code, matching the note's "bare commodity suffix" and the
// worked ISK example). -0.00 is normalized to 0.00 so a near-zero float
// never prints a misleading sign.
function formatAmount(amount) {
  const fixed = amount.toFixed(2);
  return fixed === "-0.00" ? "0.00" : fixed;
}

// Shared posting-line renderer for both serializers: `indent` spaces, the
// account, padding, then the amount+commodity. Padding is computed so every
// posting's amount *digits* start in the same column within the
// transaction, regardless of whether that posting's amount is negative (see
// POSTING_GAP and README.md "Posting alignment").
function renderPostingLines(postings, indent) {
  const digitColumn =
    postings.reduce((max, posting) => {
      const signWidth = posting.amount < 0 ? 1 : 0;
      return Math.max(max, indent + posting.account.length + signWidth);
    }, 0) + POSTING_GAP;

  return postings.map((posting) => {
    const signWidth = posting.amount < 0 ? 1 : 0;
    const pad = digitColumn - indent - posting.account.length - signWidth;
    return `${" ".repeat(indent)}${posting.account}${" ".repeat(pad)}${formatAmount(posting.amount)} ${posting.commodity}`;
  });
}

function renderBeancountHeader(tx) {
  const quotedNarration = JSON.stringify(tx.narration);
  return tx.payee ? `${tx.date} * ${JSON.stringify(tx.payee)} ${quotedNarration}` : `${tx.date} * ${quotedNarration}`;
}

function renderBeancountMetadata(metadata) {
  return Object.entries(metadata).map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`);
}

function renderBeancountTransaction(tx, index) {
  assertTransactionShape(tx, index, "toBeancount");
  return [renderBeancountHeader(tx), ...renderBeancountMetadata(tx.metadata), ...renderPostingLines(tx.postings, 2)].join(
    "\n",
  );
}

function renderCommodityDecl(decl, index) {
  if (typeof decl !== "object" || decl === null) {
    throw new TypeError(`toBeancount: options.commodityDecls[${index}] must be an object`);
  }
  const { date, commodity, name, assetClass } = decl;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new TypeError(`toBeancount: options.commodityDecls[${index}].date must be a "YYYY-MM-DD" string`);
  }
  assertRealCalendarDate(date, `toBeancount: options.commodityDecls[${index}]`);
  if (typeof commodity !== "string" || !COMMODITY_RE.test(commodity)) {
    throw new LedgerError(
      `toBeancount: options.commodityDecls[${index}].commodity "${commodity}" must be an uppercase code`,
      "invalid_commodity",
    );
  }
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError(`toBeancount: options.commodityDecls[${index}].name must be a non-empty string`);
  }
  if (typeof assetClass !== "string" || assetClass.length === 0) {
    throw new TypeError(`toBeancount: options.commodityDecls[${index}].assetClass must be a non-empty string`);
  }
  return [`${date} commodity ${commodity}`, `  name: ${JSON.stringify(name)}`, `  asset-class: ${JSON.stringify(assetClass)}`].join(
    "\n",
  );
}

function renderAccountOpen(open, index) {
  if (typeof open !== "object" || open === null) {
    throw new TypeError(`toBeancount: options.accountOpens[${index}] must be an object`);
  }
  const { date, account, commodity } = open;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new TypeError(`toBeancount: options.accountOpens[${index}].date must be a "YYYY-MM-DD" string`);
  }
  assertRealCalendarDate(date, `toBeancount: options.accountOpens[${index}]`);
  if (typeof account !== "string" || !ACCOUNT_RE.test(account)) {
    throw new LedgerError(
      `toBeancount: options.accountOpens[${index}].account "${account}" is not PascalCase colon-joined`,
      "invalid_account",
    );
  }
  if (typeof commodity !== "string" || !COMMODITY_RE.test(commodity)) {
    throw new LedgerError(
      `toBeancount: options.accountOpens[${index}].commodity "${commodity}" must be an uppercase code`,
      "invalid_commodity",
    );
  }
  return `${date} open ${account} ${commodity}`;
}

/**
 * Render transactions (built with makeTransaction) as a Beancount ledger
 * file: optional `option` header lines, optional commodity declarations,
 * optional account-open directives, then one blank-line-separated block per
 * transaction. Section order: options, commodities, opens, transactions.
 * Returns "" for a fully empty input (no transactions, no options); a
 * non-empty result always ends with exactly one trailing newline.
 */
export function toBeancount(transactions, options = {}) {
  if (!Array.isArray(transactions)) {
    throw new TypeError("toBeancount: transactions must be an array");
  }
  if (typeof options !== "object" || options === null) {
    throw new TypeError("toBeancount: options must be an object");
  }
  const { title, operatingCurrency, accountOpens, commodityDecls } = options;
  const sections = [];

  const optionLines = [];
  if (title !== undefined) {
    if (typeof title !== "string" || title.length === 0) {
      throw new TypeError("toBeancount: options.title, when given, must be a non-empty string");
    }
    optionLines.push(`option "title" ${JSON.stringify(title)}`);
  }
  if (operatingCurrency !== undefined) {
    if (typeof operatingCurrency !== "string" || operatingCurrency.length === 0) {
      throw new TypeError("toBeancount: options.operatingCurrency, when given, must be a non-empty string");
    }
    optionLines.push(`option "operating_currency" ${JSON.stringify(operatingCurrency)}`);
  }
  if (optionLines.length > 0) sections.push(optionLines.join("\n"));

  if (commodityDecls !== undefined) {
    if (!Array.isArray(commodityDecls)) {
      throw new TypeError("toBeancount: options.commodityDecls must be an array");
    }
    const declBlocks = commodityDecls.map((decl, index) => renderCommodityDecl(decl, index));
    if (declBlocks.length > 0) sections.push(declBlocks.join("\n\n"));
  }

  if (accountOpens !== undefined) {
    if (!Array.isArray(accountOpens)) {
      throw new TypeError("toBeancount: options.accountOpens must be an array");
    }
    const openLines = accountOpens.map((open, index) => renderAccountOpen(open, index));
    if (openLines.length > 0) sections.push(openLines.join("\n"));
  }

  const txBlocks = transactions.map((tx, index) => renderBeancountTransaction(tx, index));
  if (txBlocks.length > 0) sections.push(txBlocks.join("\n\n"));

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}

// Hledger's transaction header and its trailing tag comment are both single
// physical lines, and this module's own extractIds later re-parses that same
// tag comment by splitting on ",". A raw newline in free text this module
// renders (payee, narration, or a caller-supplied metadata value -- e.g. an
// EVE wallet-journal entry's player-authored "reason" field, which is
// attacker-controlled: any player can set it on a wallet transfer) would
// splice extra lines into the exported journal that a real hledger parses as
// unrelated postings/directives; a raw "," in a tag value would inject an
// extra, attacker-chosen tag -- including a forged "id:" tag that could
// poison a later dedupeAgainst call into silently dropping a legitimate
// transaction. Beancount sidesteps both because every free-text field it
// renders goes through JSON.stringify, which already escapes both
// characters; hledger has no equivalent quoting for header/comment text, so
// this module collapses both structural characters to a plain space before
// ever assembling a hledger line.
function sanitizeHledgerText(value) {
  return value.replace(/[\r\n,]+/g, " ");
}

function renderHledgerHeader(tx) {
  const slashDate = tx.date.replaceAll("-", "/");
  const payee = tx.payee ? sanitizeHledgerText(tx.payee) : null;
  const narration = sanitizeHledgerText(tx.narration);
  const description = payee ? `${payee} | ${narration}` : narration;
  const tags = Object.entries(tx.metadata)
    .map(([key, value]) => `${sanitizeHledgerText(key)}:${sanitizeHledgerText(value)}`)
    .join(", ");
  return tags.length > 0 ? `${slashDate} ${description} ; ${tags}` : `${slashDate} ${description}`;
}

function renderHledgerTransaction(tx, index) {
  assertTransactionShape(tx, index, "toHledger");
  return [renderHledgerHeader(tx), ...renderPostingLines(tx.postings, 4)].join("\n");
}

/**
 * Render transactions as an hledger journal: optional bare `account`
 * declarations, then one blank-line-separated block per transaction. Dates
 * use hledger's slash form; payee/narration render as hledger's
 * `payee | note` split when a payee is present; metadata renders as a single
 * ` ; key:value, key:value` tag comment on the transaction header line (not
 * per-posting). Returns "" for fully empty input; a non-empty result always
 * ends with exactly one trailing newline.
 */
export function toHledger(transactions, options = {}) {
  if (!Array.isArray(transactions)) {
    throw new TypeError("toHledger: transactions must be an array");
  }
  if (typeof options !== "object" || options === null) {
    throw new TypeError("toHledger: options must be an object");
  }
  const { accountDecls } = options;
  const sections = [];

  if (accountDecls !== undefined) {
    if (!Array.isArray(accountDecls)) {
      throw new TypeError("toHledger: options.accountDecls must be an array");
    }
    const declLines = accountDecls.map((account, index) => {
      if (typeof account !== "string" || !ACCOUNT_RE.test(account)) {
        throw new LedgerError(
          `toHledger: options.accountDecls[${index}] "${account}" is not PascalCase colon-joined`,
          "invalid_account",
        );
      }
      return `account ${account}`;
    });
    if (declLines.length > 0) sections.push(declLines.join("\n"));
  }

  const txBlocks = transactions.map((tx, index) => renderHledgerTransaction(tx, index));
  if (txBlocks.length > 0) sections.push(txBlocks.join("\n\n"));

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}

const BEANCOUNT_ID_LINE_RE = /^\s*id:\s*"([^"]*)"\s*$/;

/**
 * Extract the set of `id` metadata values recorded in an already-serialized
 * ledger file, for dedup checks. `format` is "beancount" or "hledger".
 * Beancount: scans `  id: "<value>"` metadata lines. hledger: scans the
 * ` ; key:value, ...` tag comment on each transaction header line for an
 * `id:` tag (per-posting comments are not scanned -- toHledger never writes
 * one, so this matches what this module itself produces).
 */
export function extractIds(ledgerText, format) {
  if (typeof ledgerText !== "string") {
    throw new TypeError("extractIds: ledgerText must be a string");
  }
  if (format !== "beancount" && format !== "hledger") {
    throw new TypeError('extractIds: format must be "beancount" or "hledger"');
  }

  const ids = new Set();
  if (format === "beancount") {
    for (const line of ledgerText.split("\n")) {
      const match = BEANCOUNT_ID_LINE_RE.exec(line);
      if (match) ids.add(match[1]);
    }
    return ids;
  }

  for (const line of ledgerText.split("\n")) {
    const commentIndex = line.indexOf(" ; ");
    if (commentIndex === -1) continue;
    const comment = line.slice(commentIndex + 3);
    for (const tag of comment.split(",")) {
      const separatorIndex = tag.indexOf(":");
      if (separatorIndex === -1) continue;
      const key = tag.slice(0, separatorIndex).trim();
      const value = tag.slice(separatorIndex + 1).trim();
      if (key === "id" && value.length > 0) ids.add(value);
    }
  }
  return ids;
}

/**
 * Filter `transactions` down to those whose `metadata.id` is not already
 * present in `ledgerText` (per extractIds) -- the append-only,
 * skip-on-replay convention: an id already recorded is a replay and is
 * dropped, never rewritten. Every transaction must carry a non-empty string
 * `metadata.id`, or this throws LedgerError("missing_id") -- dedup without an
 * id is not meaningful.
 */
export function dedupeAgainst(ledgerText, format, transactions) {
  if (!Array.isArray(transactions)) {
    throw new TypeError("dedupeAgainst: transactions must be an array");
  }
  const existingIds = extractIds(ledgerText, format);
  return transactions.filter((tx, index) => {
    assertTransactionShape(tx, index, "dedupeAgainst");
    const id = tx.metadata.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new LedgerError(`dedupeAgainst: transactions[${index}] has no string metadata.id to dedupe on`, "missing_id");
    }
    return !existingIds.has(id);
  });
}
