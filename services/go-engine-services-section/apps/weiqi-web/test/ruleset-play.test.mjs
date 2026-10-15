import { test } from "node:test";
import assert from "node:assert/strict";
import * as go from "@red-cup-engineering/weiqi-engine";
import { readFile } from "node:fs/promises";
import { studyLink, sessionFromStudyHash } from "../public/js/study-replay.mjs";

test("Play exposes the five existing native rulesets instead of a hardwired Chinese game", async()=>{
  const page=await readFile(new URL("../public/play.html",import.meta.url),"utf8");
  const app=await readFile(new URL("../public/js/play-app.mjs",import.meta.url),"utf8");
  assert.ok(page.includes('id="ruleset-select"'));
  assert.match(app,/Object.entries\(kernel.RULESETS\)/);
  assert.match(app,/session = kernel.createWeiqiGameSession\(\{ size, ruleset \}\)/);
  assert.match(app,/rulesetSelect\.value = ruleset/);
  assert.match(app,/Object.hasOwn\(kernel.RULESETS, ruleset\)/);
  assert.doesNotMatch(app,/const RULESET =/);
});

test("actual Go rules, scoring and accepted game replay survive every ruleset selection",()=>{
  const kinds=["chinese","japanese","aga","newzealand","ing"];
  assert.deepEqual(Object.keys(go.RULESETS).sort(),[...kinds].sort());
  for(const name of kinds){
    const session=go.createWeiqiGameSession({size:9,ruleset:name},[
      {kind:"play",move:"C3"},{kind:"play",move:"G7"},
      {kind:"pass"},{kind:"pass"},{kind:"settle",dead:[]},
    ]);
    const score=go.scoreWeiqiSession(session);
    const mode=name==="japanese"?"territory":"area";
    assert.equal(score.mode,mode,name);
    assert.equal(session.config.ruleset,name);
    assert.equal(score.ruleset.komi,go.RULESETS[name].komi);
    const href=studyLink(session,"https://weiqi.play.561.group/play.html");
    const opened=sessionFromStudyHash(new URL(href).hash);
    assert.equal(opened.ok,true,opened?.reason);
    assert.deepEqual(opened.session.commands,session.commands);
    assert.equal(opened.session.state.result?.by,"count");
  }
});
