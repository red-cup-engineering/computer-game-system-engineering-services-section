#!/usr/bin/env node
/**
 * `scripts/run-cast-member.mjs` — the one effect boundary that connects a cast persona to a live
 * or local FeltOS telnet world. See `main`'s doc for usage and behavior.
 */
import { parseArgs } from 'node:util';
import { createWriteStream } from 'node:fs';
import { getAuthoredPersona } from '../src/persona.mjs';
import { wanderPolicy } from '../src/policy/wander.mjs';
import { createRunner } from '../src/runner.mjs';
import { createTelnetAdapter } from '../src/adapters/telnet.mjs';

const USAGE = 'usage: run-cast-member.mjs --persona <id> --host <host> --port <port> '
  + '[--seed <s>] [--max-steps <n>] [--max-duration-ms <n>] [--log <path>]';

/**
 * Run one authored persona against one FeltOS telnet server, bounded by step count and wall-
 * clock duration, writing every `../src/runner.d.ts` `CastEvent` verbatim as one NDJSON line per
 * event to `--log <path>` (default: stdout). Deterministic given `(--persona, --seed)`: every
 * rng draw and dialogue line the wander policy makes derives from `--seed`. Always calls
 * `runner.stop()` at the duration deadline, so the runner's own `finally` block still sends
 * `quit` and disconnects cleanly.
 * @param {readonly string[]} argv the CLI arguments after the script path (e.g. `process.argv.slice(2)`).
 * @returns {Promise<number>} the process exit code (0 on a completed or bounded-stop run).
 */
export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      persona: { type: 'string' },
      host: { type: 'string' },
      port: { type: 'string' },
      seed: { type: 'string' },
      'max-steps': { type: 'string', default: '40' },
      'max-duration-ms': { type: 'string', default: '120000' },
      log: { type: 'string' },
    },
  });

  if (!values.persona || !values.host || !values.port) {
    console.error(USAGE);
    return 1;
  }

  const persona = getAuthoredPersona(values.persona);
  if (persona === null) {
    console.error(`run-cast-member.mjs: unknown persona id "${values.persona}"`);
    return 1;
  }

  const port = Number.parseInt(values.port, 10);
  const maxSteps = Number.parseInt(values['max-steps'], 10);
  const maxDurationMs = Number.parseInt(values['max-duration-ms'], 10);
  const seed = values.seed ?? `run-cast-member:${persona.id}:${Date.now()}`;

  const sink = values.log ? createWriteStream(values.log, { flags: 'a' }) : process.stdout;
  const transport = createTelnetAdapter({ host: values.host, port });
  const runner = createRunner({ persona, policy: wanderPolicy, transport, seed, maxSteps });

  const deadlineAt = Date.now() + maxDurationMs;
  const deadlineTimer = setInterval(() => {
    if (Date.now() >= deadlineAt) runner.stop();
  }, 250);

  try {
    for await (const event of runner.events()) {
      sink.write(`${JSON.stringify(event)}\n`);
    }
  } finally {
    clearInterval(deadlineTimer);
    if (values.log) sink.end();
  }
  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (error) => { console.error('run-cast-member.mjs:', error); process.exitCode = 1; },
  );
}
