#!/usr/bin/env node
import readline from "node:readline";

/**
 * @packageDocumentation
 * A deterministic stand-in engine for the test suite, speaking either GTP
 * version 2 (`node stub-engine.mjs gtp`) or the KataGo JSON analysis
 * protocol (`node stub-engine.mjs analysis`) over its own stdio. Never
 * published; test-only fixture.
 */

const mode = process.argv[2] === "analysis" ? "analysis" : "gtp";
const rl = readline.createInterface({ input: process.stdin, terminal: false });

const KNOWN_GTP_COMMANDS = new Set([
  "protocol_version",
  "name",
  "version",
  "boardsize",
  "clear_board",
  "komi",
  "play",
  "genmove",
  "showboard",
  "quit",
]);

function writeGtpReply(status, id, text) {
  const idPart = id === null ? "" : String(id);
  const body = text ? ` ${text}` : "";
  process.stdout.write(`${status}${idPart}${body}\n\n`);
}

function writeGtpShowboard(id) {
  const idPart = id === null ? "" : String(id);
  const lines = [`=${idPart} `, "   A B C D E", " 5 . . . . .", " 4 . . . X .", " 3 . . . . ."];
  process.stdout.write(`${lines.join("\n")}\n\n`);
}

if (mode === "gtp") {
  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/\s+/);
    let id = null;
    let index = 0;
    if (/^\d+$/.test(parts[0])) {
      id = Number(parts[0]);
      index = 1;
    }
    const command = parts[index];
    if (!KNOWN_GTP_COMMANDS.has(command)) {
      writeGtpReply("?", id, "unknown command");
      return;
    }
    switch (command) {
      case "protocol_version":
        writeGtpReply("=", id, "2");
        break;
      case "name":
        writeGtpReply("=", id, "stub-engine");
        break;
      case "version":
        writeGtpReply("=", id, "0.0.0-stub");
        break;
      case "boardsize":
      case "clear_board":
      case "komi":
      case "play":
        writeGtpReply("=", id, "");
        break;
      case "genmove":
        writeGtpReply("=", id, "D4");
        break;
      case "showboard":
        writeGtpShowboard(id);
        break;
      case "quit":
        writeGtpReply("=", id, "");
        rl.close();
        process.exitCode = 0;
        break;
      default:
        writeGtpReply("?", id, "unknown command");
    }
  });
} else {
  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) return;
    let query;
    try {
      query = JSON.parse(line);
    } catch {
      return;
    }
    // fixed fixture: four points covering all four FOUR outcomes at the derive-readout-envelope defaults
    const ownership = [0.9, -0.9, 0.05, 0.05];
    const ownershipStdev = [0.01, 0.01, 0.01, 0.5];
    const response = {
      id: query.id,
      moveInfos: [{ move: "D4", visits: 100, winrate: 0.55 }],
      rootInfo: {
        winrate: 0.55,
        visits: 100,
        boardXSize: query.boardXSize ?? 2,
        boardYSize: query.boardYSize ?? 2,
      },
      ownership,
      ownershipStdev,
    };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}
