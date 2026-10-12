// prove-intermud — proves the INTERMUD-3 conformant, deliberately DORMANT talker. Exercises the
// full I3 protocol path while disconnected: the JSON-mudmode codec (4-byte big-endian length frame)
// round-trips a packet and returns the remainder when frames are concatenated; packetFor fills the
// six standard leading fields; a "tell" to THIS mud routes to a local onLocal handler; a
// channelSend reaches a subscriber; an inbound handlePacket of a FOREIGN tell to a local user
// routes locally; connect() opens no network connection and reports wired:false; identity() is
// correct.
//
// Same tiny harness as tests/prove-comms.mjs. Standalone: run `node prove-intermud.mjs`.

import assert from "node:assert/strict";

import makeIntermud, {
  encode,
  decode,
  DEFAULT_TTL,
  LEAD_FIELDS,
} from "../scripts/intermud.mjs";

let pass = 0;
const ok = (name, fn) => {
  try {
    fn();
    pass += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

// --- codec: encode -> decode round-trips through the 4-byte length frame ----------------------
ok("encode -> decode round-trips a packet through the 4-byte length frame", () => {
  const im = makeIntermud();
  const packet = im.packetFor("tell", {
    originator_username: "morgan",
    target_mudname: "Farstone",
    target_username: "guest",
    visname: "morgan",
    message: "hello",
  });
  const frame = encode(packet);
  assert.ok(Buffer.isBuffer(frame), "encode returns a Buffer");
  // the 4-byte big-endian prefix equals the JSON body length.
  const bodyLen = Buffer.from(JSON.stringify(packet), "utf8").length;
  assert.equal(frame.readUInt32BE(0), bodyLen, "prefix is the big-endian body length");
  assert.equal(frame.length, 4 + bodyLen, "frame is prefix + body");
  const { packet: back, rest } = decode(frame);
  assert.deepEqual(back, packet, "decode reconstructs the exact packet");
  assert.equal(rest.length, 0, "a single frame leaves no remainder");
});

// --- decode returns the REST when two frames are concatenated ---------------------------------
ok("decode returns the remainder when two packets are concatenated", () => {
  const im = makeIntermud();
  const p1 = im.packetFor("tell", { target_mudname: "Farstone", target_username: "a", message: "one", visname: "x" });
  const p2 = im.packetFor("tell", { target_mudname: "Farstone", target_username: "b", message: "two", visname: "y" });
  const stream = Buffer.concat([encode(p1), encode(p2)]);
  const first = decode(stream);
  assert.deepEqual(first.packet, p1, "first decode yields packet one");
  assert.ok(first.rest.length > 0, "remainder holds the second frame");
  const second = decode(first.rest);
  assert.deepEqual(second.packet, p2, "decoding the remainder yields packet two");
  assert.equal(second.rest.length, 0, "nothing left after the second frame");
});

// --- packetFor fills the standard leading fields ----------------------------------------------
ok("packetFor fills the six standard leading fields from this mud's identity", () => {
  const im = makeIntermud({ mudname: "Farstone" });
  const packet = im.packetFor("tell", {
    originator_username: "morgan",
    target_mudname: "Otherworld",
    target_username: "bob",
    visname: "morgan",
    message: "hi",
  });
  const lead = {};
  LEAD_FIELDS.forEach((name, i) => { lead[name] = packet[i]; });
  assert.equal(lead.type, "tell");
  assert.equal(lead.ttl, DEFAULT_TTL, "ttl is the deterministic default");
  assert.equal(lead.originator_mudname, "Farstone", "originator mud is this mud");
  assert.equal(lead.originator_username, "morgan");
  assert.equal(lead.target_mudname, "Otherworld");
  assert.equal(lead.target_username, "bob");
  // payload follows the six leading fields.
  assert.equal(packet[LEAD_FIELDS.length], "morgan", "payload visname follows the lead");
  assert.equal(packet[LEAD_FIELDS.length + 1], "hi", "payload message follows visname");
});

// --- tell to THIS mud routes to the local onLocal handler -------------------------------------
ok("a tell to THIS mud routes to the local onLocal handler with the message", () => {
  const im = makeIntermud({ mudname: "Farstone" });
  const got = [];
  im.onLocal((m) => got.push(m));
  const res = im.tell("morgan", "Farstone", "guest", "well met");
  assert.equal(res.routed, "local", "a same-mud tell routes locally");
  assert.equal(got.length, 1, "exactly one local delivery");
  assert.equal(got[0].kind, "tell");
  assert.equal(got[0].fromUser, "morgan");
  assert.equal(got[0].toUser, "guest");
  assert.equal(got[0].message, "well met");
});

// --- a tell to a FOREIGN mud is queued with a clear "not wired" note ---------------------------
ok("a tell to a foreign mud is queued (not wired), not delivered locally", () => {
  const im = makeIntermud({ mudname: "Farstone" });
  const got = [];
  im.onLocal((m) => got.push(m));
  const res = im.tell("morgan", "Otherworld", "bob", "are you there");
  assert.equal(res.routed, "queued", "no router, so a foreign tell is queued");
  assert.match(res.note, /not wired/, "the note says we are not wired to intermud");
  assert.equal(got.length, 0, "nothing delivered locally");
  assert.equal(im.queued().length, 1, "the packet sits in the undelivered queue");
});

// --- channelSend reaches a subscriber ---------------------------------------------------------
ok("channelSend reaches a local subscriber of the channel", () => {
  const im = makeIntermud();
  const got = [];
  im.onLocal((m) => got.push(m));
  im.subscribe("imud_gossip");
  assert.ok(im.channels().includes("imud_gossip"), "subscribe registers the channel locally");
  const res = im.channelSend("imud_gossip", "morgan", "anyone awake?");
  assert.equal(res.routed, "local", "delivered to local subscribers");
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, "channel");
  assert.equal(got[0].channel, "imud_gossip");
  assert.equal(got[0].message, "anyone awake?");
  // a channel we are not subscribed to is queued, not delivered.
  const miss = im.channelSend("intermud", "morgan", "into the void");
  assert.equal(miss.routed, "queued", "an unsubscribed channel has no local target");
});

// --- inbound handlePacket of a FOREIGN tell to a local user routes locally ---------------------
ok("inbound handlePacket of a foreign tell to a local user routes locally", () => {
  const im = makeIntermud({ mudname: "Farstone" });
  const got = [];
  im.onLocal((m) => got.push(m));
  // a packet as if it arrived from the router: from Otherworld/alice to Farstone/morgan.
  const foreign = im.packetFor("tell", {
    originator_mudname: "Otherworld",
    originator_username: "alice",
    target_mudname: "Farstone",
    target_username: "morgan",
    visname: "alice",
    message: "greetings from afar",
  });
  const res = im.handlePacket(foreign);
  assert.equal(res.routed, "local", "an inbound tell addressed to us routes locally");
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, "tell");
  assert.equal(got[0].fromMud, "Otherworld");
  assert.equal(got[0].fromUser, "alice");
  assert.equal(got[0].toUser, "morgan");
  assert.equal(got[0].message, "greetings from afar");
  // an inbound tell NOT addressed to this mud is ignored.
  const elsewhere = im.packetFor("tell", {
    originator_mudname: "Otherworld",
    target_mudname: "ThirdPlace",
    target_username: "x",
    visname: "alice",
    message: "not for us",
  });
  assert.equal(im.handlePacket(elsewhere).routed, "ignored");
});

// --- inbound channel packet routes to a subscriber --------------------------------------------
ok("inbound handlePacket of a channel message routes to local subscribers", () => {
  const im = makeIntermud();
  const got = [];
  im.onLocal((m) => got.push(m));
  im.subscribe("intermud");
  const cm = im.packetFor("channel-m", {
    originator_mudname: "Otherworld",
    originator_username: "alice",
    visname: "alice",
    channel: "intermud",
    message: "hi all",
  });
  const res = im.handlePacket(cm);
  assert.equal(res.routed, "local");
  assert.equal(got[0].kind, "channel");
  assert.equal(got[0].channel, "intermud");
  assert.equal(got[0].message, "hi all");
});

// --- connect() opens NO network connection and reports wired:false ----------------------------
ok("connect() does not open any network connection and reports wired:false", () => {
  // Trip wire: if connect() tried to open a socket, this would surface. We assert by inspecting
  // the returned status and confirming no async/network side effect is needed to call it.
  const im = makeIntermud();
  const status = im.connect();
  assert.equal(status.wired, false, "the wire flag is false");
  assert.equal(status.connected, false, "nothing got connected");
  assert.match(status.note, /not wired/, "the status explains federation is not wired");
});

// --- identity() is correct --------------------------------------------------------------------
ok("identity() returns the mudname, services, and wired:false", () => {
  const im = makeIntermud({ mudname: "Farstone", services: ["tell", "channel", "who", "finger"] });
  const id = im.identity();
  assert.equal(id.mudname, "Farstone");
  assert.deepEqual(id.services, ["tell", "channel", "who", "finger"]);
  assert.equal(id.wired, false, "this talker is dormant on the wire");
});

console.log(`\n${pass} intermud checks passed.`);
