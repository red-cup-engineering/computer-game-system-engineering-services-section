#!/usr/bin/env node
import{readFileSync}from"node:fs";import{projectOrchestration}from"../src/orchestration.mjs";export{projectOrchestration};if(import.meta.main){const i=JSON.parse(readFileSync(0,"utf8"));process.stdout.write(`${JSON.stringify(projectOrchestration(i.play,i.options))}\n`);}
