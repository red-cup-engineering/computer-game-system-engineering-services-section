#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { projectSitePlay } from "../src/site-play.mjs";

export { projectSitePlay };

if (import.meta.main) process.stdout.write(`${JSON.stringify(projectSitePlay(JSON.parse(readFileSync(0, "utf8"))))}\n`);
