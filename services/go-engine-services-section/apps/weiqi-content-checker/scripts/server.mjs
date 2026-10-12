#!/usr/bin/env node
// The long-lived LSP transport face. Per SPEC.md's "LSP surface": stdio,
// Content-Length JSON-RPC framing, textDocumentSync: Full, hoverProvider
// only -- no completion/codeAction/formatting/rename capability, ever
// (structural enforcement of "weiqi-lsp never modifies files").
//
// Messages are read from stdin and written to stdout ONLY; every log line
// goes to stderr, since a single stray byte on stdout corrupts the
// JSON-RPC stream for every subsequent message.

import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadKernel, DEFAULT_KERNEL_PATH } from "../src/kernel.mjs";
import { checkMarkdownFile, checkJsonFile } from "../src/run.mjs";
import { extractFences } from "../src/markdown.mjs";
import { isDiagramFence, checkDiagramFence } from "../src/diagram.mjs";

const SECTION_ROOT = fileURLToPath(new URL("../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section", import.meta.url));

const SEVERITY_TO_LSP = { error: 1, warning: 2, info: 3 };

function log(message) {
  process.stderr.write(`weiqi-lsp server: ${message}\n`);
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function toLspDiagnostic(d) {
  const startLine = Math.max(0, (d.start?.line ?? 1) - 1);
  const startChar = Math.max(0, (d.start?.column ?? 1) - 1);
  const endLine = Math.max(0, (d.end?.line ?? d.start?.line ?? 1) - 1);
  const endChar = Math.max(0, (d.end?.column ?? (d.start?.column ?? 1) + 1) - 1);
  return {
    range: { start: { line: startLine, character: startChar }, end: { line: endLine, character: endChar } },
    severity: SEVERITY_TO_LSP[d.severity],
    code: d.code,
    source: "weiqi-lsp",
    message: `${d.message} (${d.source})`,
  };
}

function uriToPath(uri) {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri; // not a file: URI (e.g. an untitled buffer) -- best effort.
  }
}

/** WQ019's boundary, at the protocol level: hover reports only what findGroup mechanically returns -- never a life-and-death verdict. */
function computeHover(text, position, kernel) {
  const fences = extractFences(text);
  for (const fence of fences) {
    if (!isDiagramFence(fence)) continue;
    const { diagram } = checkDiagramFence(fence, "(buffer)", kernel);
    const hoverLine1 = position.line + 1;
    const headerLine1 = fence.contentStartLine;
    const rowIndex = hoverLine1 - headerLine1 - 1;
    if (rowIndex < 0 || rowIndex >= diagram.height) continue;
    const rowLine = fence.contentLines[1 + rowIndex];
    if (rowLine === undefined) continue;

    const tokenRe = /\S+/g;
    let m;
    let tokenIndex = 0;
    let colIndex = null;
    while ((m = tokenRe.exec(rowLine)) !== null) {
      if (position.character >= m.index && position.character < m.index + m[0].length) {
        colIndex = tokenIndex - 1; // token 0 is the row-number label, not a board column.
        break;
      }
      tokenIndex++;
    }
    if (colIndex === null || colIndex < 0 || colIndex >= diagram.width) continue;

    const point = rowIndex * diagram.width + colIndex;
    if (diagram.cells[point] === kernel.EMPTY) return null;
    const group = kernel.findGroup(diagram.cells, diagram.width, diagram.height, point);
    const colorName = group.color === kernel.BLACK ? "Black" : "White";
    const libertyCoords = [...group.liberties].map((p) => kernel.pointToCoord(diagram.width, p)).sort();
    const value = `${colorName} group -- ${group.stones.length} stone(s), ${group.liberties.size} liberty(ies): ${
      libertyCoords.length > 0 ? libertyCoords.join(", ") : "(none)"
    }`;
    return { contents: { kind: "plaintext", value } };
  }
  return null;
}

function publishDiagnosticsFor(uri, text, kernel) {
  const absPath = uriToPath(uri);
  const relPath = relative(SECTION_ROOT, absPath);
  let diagnostics;
  if (relPath.endsWith(".json")) {
    try {
      diagnostics = checkJsonFile(JSON.parse(text), relPath, kernel);
    } catch {
      diagnostics = []; // malformed JSON in an unsaved buffer: nothing safe to check yet, not a crash.
    }
  } else {
    diagnostics = checkMarkdownFile(text, relPath, absPath, SECTION_ROOT, kernel);
  }
  send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: diagnostics.map(toLspDiagnostic) } });
}

async function main() {
  const kernelPathArg = process.argv.slice(2).find((a) => a.startsWith("--kernel-path="));
  const kernelPath = kernelPathArg ? kernelPathArg.slice("--kernel-path=".length) : DEFAULT_KERNEL_PATH;

  let kernel;
  try {
    kernel = await loadKernel(kernelPath);
  } catch (err) {
    log(`could not load weiqi-kernel: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  /** @type {Map<string, string>} */
  const documents = new Map();
  let shuttingDown = false;

  function handleMessage(msg) {
    const { method, id, params } = msg;

    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          capabilities: {
            textDocumentSync: 1, // Full -- Phase 1 scoping choice, see SPEC.md.
            hoverProvider: true,
            // Deliberately absent: completionProvider, codeActionProvider,
            // documentFormattingProvider, renameProvider -- see SPEC.md
            // "LSP surface" and the constitution's Non-ownership clause.
          },
        },
      });
      return;
    }
    if (method === "initialized") return; // notification, no response.
    if (method === "shutdown") {
      shuttingDown = true;
      send({ jsonrpc: "2.0", id, result: null });
      return;
    }
    if (method === "exit") {
      process.exit(shuttingDown ? 0 : 1);
      return;
    }
    if (method === "textDocument/didOpen") {
      const { uri, text } = params.textDocument;
      documents.set(uri, text);
      publishDiagnosticsFor(uri, text, kernel);
      return;
    }
    if (method === "textDocument/didChange") {
      const uri = params.textDocument.uri;
      const changes = params.contentChanges;
      const text = changes[changes.length - 1]?.text ?? ""; // Full sync: last change carries the whole document.
      documents.set(uri, text);
      publishDiagnosticsFor(uri, text, kernel);
      return;
    }
    if (method === "textDocument/didClose") {
      const uri = params.textDocument.uri;
      documents.delete(uri);
      send({ jsonrpc: "2.0", method: "textDocument/publishDiagnostics", params: { uri, diagnostics: [] } });
      return;
    }
    if (method === "textDocument/hover") {
      // Accept BOTH wire shapes: the real LSP protocol always nests the uri
      // under textDocument ({textDocument: {uri}, position} -- the exact
      // shape didOpen/didChange/didClose already use above), which is
      // primary here; SPEC.md's own flat {uri, position} is accepted too,
      // for compatibility with anything already speaking it. SPEC.md's
      // hover section had this backwards (flat only), a defect this
      // implementation faithfully reproduced -- corrected in SPEC.md
      // itself per the project's change-authority rule; see the dated
      // correction note there and the README's Deviations section.
      const uri = params.textDocument?.uri ?? params.uri;
      const { position } = params;
      const text = documents.get(uri) ?? "";
      const result = computeHover(text, position, kernel);
      send({ jsonrpc: "2.0", id, result });
      return;
    }
    if (id !== undefined) {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  }

  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (!match) {
        log(`malformed frame header, dropping: ${JSON.stringify(headerText)}`);
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return; // wait for more bytes.
      const body = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
      buffer = buffer.slice(bodyStart + length);
      try {
        handleMessage(JSON.parse(body));
      } catch (err) {
        log(`error handling message: ${err instanceof Error ? err.stack : err}`);
      }
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

main();
