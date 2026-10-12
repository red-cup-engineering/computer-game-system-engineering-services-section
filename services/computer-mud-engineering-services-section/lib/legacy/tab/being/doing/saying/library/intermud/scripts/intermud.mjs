// intermud — an INTERMUD-3 (I3) CONFORMANT talker for TAB, deliberately DORMANT on the wire.
//
// WHAT THIS IS. Intermud-3 is a MUD-to-MUD network. Each MUD connects to a ROUTER and exchanges
// PACKETS. A packet is an ordered array (in real I3, LPC "mudmode"), conventionally led by a
// fixed set of fields:
//
//   ({ type, ttl, originator_mudname, originator_username,
//      target_mudname, target_username, ...payload })
//
// Common packet TYPES this module knows about:
//   "startup-req-3"  — the handshake a MUD sends to the router on connect.
//   "tell"           — a private directed message. payload = (visname, message).
//   "emoteto"        — a directed emote. payload = (visname, message).
//   "channel-m"      — a channel message. payload = (channel, visname, message).
//   "channel-e"      — a channel emote. payload = (channel, visname, message).
//   "who-req"/"who-reply", "finger-req", "mudlist", "chanlist-reply" — service queries.
// Channels are named (e.g. "intermud", "imud_gossip").
//
// FRAMING. On the real wire, I3 uses "mudmode": a 4-byte big-endian length prefix followed by the
// LPC-serialized array. This module IMPLEMENTS the 4-byte big-endian length framing in
// encode/decode, but — deliberately and explicitly — serializes the packet body as JSON rather
// than full LPC. So this is a JSON-mudmode: CONFORMANT IN SHAPE (ordered array, leading fields,
// length-prefixed frame), simpler on the wire. A real federation seam would swap the JSON body
// codec for an LPC codec; the framing and packet shape would not change.
//
// DELIBERATELY NOT WIRED. This talker speaks the I3 protocol SHAPE and routes those messages
// LOCALLY. It is CONFORMANT so it COULD federate, but it is NOT connected to any live intermud
// router. `connect()` is the single dormant network-egress seam: it opens NO socket, performs NO
// DNS, returns `{ wired: false }`. Flipping federation on is exactly one change — give `connect()`
// a real router transport and feed received frames into `handlePacket`. Everything else (codec,
// packet construction, local routing) already exercises the full protocol path while disconnected.
//
// RELATION TO TAB's SPEECH MODEL (being/doing/saying/scripts/say.mjs). In TAB, an utterance is an
// AMBIENT entity located-in a room (everyone co-located perceives it), and `tell` is the DIRECTED
// variant located-in a single listener. This talker's LOCAL routing mirrors that: an I3 "tell" is
// a directed message to one local user (TAB `tell`), and an I3 "channel-m" is an ambient message
// delivered to every local subscriber of the channel (TAB ambient `say` into a shared space). This
// module does NOT call into say.mjs — it is a self-contained codec + router exposing a clean API
// (`onLocal`) the integrator wires to say/tell later.
//
// DETERMINISM. No Date.now(), no Math.random(). TTL is a fixed constant. Ids and ordering are
// derived only from inputs.
//
// API (see makeIntermud below):
//   encode(packet) -> Buffer            decode(buf) -> { packet, rest }
//   packetFor(type, fields) -> array    tell(fromUser, targetMud, targetUser, message) -> packet
//   channelSend(channel, fromUser, message) -> packet
//   onLocal(handler)                    subscribe(channel) / channels()
//   connect()  (dormant, wired:false)   handlePacket(packet) -> routing result
//   identity() -> { mudname, services, wired:false }

// ---------------------------------------------------------------------------------------------
// Protocol constants.

// The default time-to-live a fresh outbound packet carries. In real I3 the router decrements ttl
// at each hop and drops the packet at zero; a typical starting value is small. Fixed (not random,
// not clock-derived) so packet construction is deterministic.
export const DEFAULT_TTL = 5;

// The ordered LEADING fields every I3 packet array begins with, by index. The payload follows.
export const LEAD_FIELDS = [
  "type",
  "ttl",
  "originator_mudname",
  "originator_username",
  "target_mudname",
  "target_username",
];

// The payload shape (fields AFTER the six leading fields) for the packet types we route locally.
// Each entry is the ordered list of payload field names appended to the lead.
export const PAYLOAD_FIELDS = {
  tell: ["visname", "message"],
  emoteto: ["visname", "message"],
  "channel-m": ["channel", "visname", "message"],
  "channel-e": ["channel", "visname", "message"],
};

// ---------------------------------------------------------------------------------------------
// Codec — the JSON-mudmode frame: a 4-byte big-endian length prefix + JSON body.

// encode — serialize one packet to a length-prefixed Buffer. Body is JSON (documented above as a
// stand-in for LPC). The 4-byte big-endian prefix is the byte length of the JSON body, matching
// the I3 mudmode frame header.
export function encode(packet) {
  const body = Buffer.from(JSON.stringify(packet), "utf8");
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
}

// decode — parse exactly ONE framed packet off the front of `buf`. Returns the decoded packet and
// the REST (a Buffer of whatever bytes follow this frame), so a stream of concatenated frames can
// be drained by calling decode repeatedly. Throws if the buffer does not yet hold a full frame.
export function decode(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (buf.length < 4) throw new RangeError("decode: buffer too short for a length prefix");
  const len = buf.readUInt32BE(0);
  if (buf.length < 4 + len) throw new RangeError("decode: buffer holds an incomplete frame");
  const body = buf.subarray(4, 4 + len).toString("utf8");
  const packet = JSON.parse(body);
  const rest = buf.subarray(4 + len);
  return { packet, rest };
}

// ---------------------------------------------------------------------------------------------
// The talker.

export function makeIntermud({
  mudname = "Farstone",
  services = ["tell", "channel", "who", "finger"],
} = {}) {
  // Local routing state. None of this touches the network.
  const localHandlers = []; // registered onLocal handlers
  const subscriptions = new Set(); // channels this MUD is locally subscribed to
  const undelivered = []; // packets we'd send to a router but can't (not wired)

  // identity — who this MUD claims to be on the I3 network, plus the dormant-wire flag.
  function identity() {
    return { mudname, services: [...services], wired: false };
  }

  // packetFor — build a well-formed I3 packet ARRAY: the six leading fields followed by the
  // payload for `type`. Leading fields default from THIS mud's identity; `fields` overrides any of
  // them (e.g. target_mudname/target_username) and supplies the payload values (visname, message,
  // channel). Unspecified targets are 0 (the I3 convention for "no specific target" / broadcast).
  function packetFor(type, fields = {}) {
    const f = {
      type,
      ttl: DEFAULT_TTL,
      originator_mudname: mudname,
      originator_username: 0,
      target_mudname: 0,
      target_username: 0,
      ...fields,
    };
    const packet = LEAD_FIELDS.map((name) => f[name]);
    const payload = PAYLOAD_FIELDS[type] || [];
    for (const name of payload) packet.push(f[name]);
    return packet;
  }

  // deliverLocal — hand a routed message to every registered local handler. The message is a plain
  // object the integrator maps onto TAB's say/tell. Returns how many handlers received it.
  function deliverLocal(message) {
    for (const h of localHandlers) h(message);
    return { delivered: true, handlers: localHandlers.length, message };
  }

  // onLocal — register a handler for locally-routed messages. A handler receives objects like
  //   { kind: "tell",    fromMud, fromUser, toUser, message }
  //   { kind: "channel", channel, fromMud, fromUser, message }
  // This is the seam the integrator wires to say/tell.
  function onLocal(handler) {
    if (typeof handler !== "function") throw new TypeError("onLocal: handler must be a function");
    localHandlers.push(handler);
    return () => {
      const i = localHandlers.indexOf(handler);
      if (i >= 0) localHandlers.splice(i, 1);
    };
  }

  // subscribe / channels — the LOCAL channel model. subscribe adds a channel; channels lists them.
  function subscribe(channel) {
    subscriptions.add(channel);
    return [...subscriptions];
  }
  function channels() {
    return [...subscriptions];
  }

  // tell — construct a "tell" packet and route it. Because we are NOT wired, routing is local: if
  // the target mud IS this mud, deliver to the local handlers; otherwise we can't reach a foreign
  // mud (no router), so we queue the packet and return a clear "not wired" note.
  function tell(fromUser, targetMud, targetUser, message) {
    const packet = packetFor("tell", {
      originator_username: fromUser,
      target_mudname: targetMud,
      target_username: targetUser,
      visname: fromUser,
      message,
    });
    if (targetMud === mudname) {
      const routed = deliverLocal({
        kind: "tell",
        fromMud: mudname,
        fromUser,
        toUser: targetUser,
        message,
      });
      return { packet, routed: "local", ...routed };
    }
    undelivered.push(packet);
    return {
      packet,
      routed: "queued",
      note: "not wired to intermud — foreign tell queued, no router to deliver it",
    };
  }

  // channelSend — construct a "channel-m" packet and deliver it to LOCAL subscribers of `channel`.
  // If this mud is not subscribed, there is nowhere local to deliver, so it is queued.
  function channelSend(channel, fromUser, message) {
    const packet = packetFor("channel-m", {
      originator_username: fromUser,
      visname: fromUser,
      channel,
      message,
    });
    if (subscriptions.has(channel)) {
      const routed = deliverLocal({
        kind: "channel",
        channel,
        fromMud: mudname,
        fromUser,
        message,
      });
      return { packet, routed: "local", ...routed };
    }
    undelivered.push(packet);
    return {
      packet,
      routed: "queued",
      note: `not subscribed to '${channel}' locally — channel message queued`,
    };
  }

  // handlePacket — process an INBOUND packet (as if a router handed it to us) and route it locally.
  // Accepts the packet array. Reads the leading fields by index and dispatches by type. This is
  // what exercises the full protocol path while disconnected: feed it a packet, watch it route.
  function handlePacket(packet) {
    if (!Array.isArray(packet)) throw new TypeError("handlePacket: packet must be an array");
    const lead = {};
    LEAD_FIELDS.forEach((name, i) => { lead[name] = packet[i]; });
    const type = lead.type;
    const payloadNames = PAYLOAD_FIELDS[type] || [];
    const payload = {};
    payloadNames.forEach((name, i) => { payload[name] = packet[LEAD_FIELDS.length + i]; });

    if (type === "tell" || type === "emoteto") {
      // A directed message to a local user. Deliver if it is addressed to this mud.
      if (lead.target_mudname !== mudname) {
        return { routed: "ignored", note: "tell not addressed to this mud" };
      }
      return {
        routed: "local",
        ...deliverLocal({
          kind: "tell",
          fromMud: lead.originator_mudname,
          fromUser: payload.visname ?? lead.originator_username,
          toUser: lead.target_username,
          message: payload.message,
        }),
      };
    }

    if (type === "channel-m" || type === "channel-e") {
      // A channel message. Deliver to local subscribers of that channel.
      if (!subscriptions.has(payload.channel)) {
        return { routed: "ignored", note: `not subscribed to '${payload.channel}'` };
      }
      return {
        routed: "local",
        ...deliverLocal({
          kind: "channel",
          channel: payload.channel,
          fromMud: lead.originator_mudname,
          fromUser: payload.visname ?? lead.originator_username,
          message: payload.message,
        }),
      };
    }

    // Service/handshake packets we recognize but do not act on while disconnected.
    return { routed: "noop", type, note: "recognized packet type; no local routing defined" };
  }

  // connect — the DORMANT network-egress seam. It MUST NOT open a socket, resolve DNS, or reach a
  // router. It is a no-op that reports the wire is not connected. Federation is enabled by giving
  // THIS function a real transport and piping received frames (decode) into handlePacket.
  function connect() {
    return {
      wired: false,
      connected: false,
      note: "intermud federation is not wired — connect() is a dormant no-op (the single future seam)",
    };
  }

  // startupPacket — the handshake a wired MUD would send first. Exposed so the shape is testable;
  // unused while dormant.
  function startupPacket() {
    return packetFor("startup-req-3", { target_mudname: 0 });
  }

  // queued — inspect packets that could not be delivered locally (would go to a router if wired).
  function queued() {
    return undelivered.map((p) => [...p]);
  }

  return {
    mudname,
    services: [...services],
    wired: false,
    identity,
    encode,
    decode,
    packetFor,
    startupPacket,
    tell,
    channelSend,
    onLocal,
    subscribe,
    channels,
    handlePacket,
    connect,
    queued,
  };
}

export default makeIntermud;

// CLI guard — `node intermud.mjs` prints this MUD's identity and a sample framed tell, to show the
// codec round-trips. Does NOT connect to anything.
if (import.meta.url === `file://${process.argv[1]}`) {
  const im = makeIntermud();
  const packet = im.packetFor("tell", {
    originator_username: "morgan",
    target_mudname: im.mudname,
    target_username: "guest",
    visname: "morgan",
    message: "hail from the dormant talker",
  });
  const frame = encode(packet);
  const { packet: back, rest } = decode(frame);
  console.log(JSON.stringify({
    identity: im.identity(),
    connect: im.connect(),
    packet,
    frameBytes: frame.length,
    roundTrips: JSON.stringify(packet) === JSON.stringify(back),
    restBytes: rest.length,
  }, null, 2));
}
