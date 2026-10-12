// webaudio-adapter.mjs
//
// Barrel module for this package's `./web` export: the browser-side glue
// between the node-testable synthesis core (../voice/voice.mjs's
// renderVoice) and a real WebAudio graph.
//
// Rendering architecture: render-to-buffer, not a parallel node graph
// -------------------------------------------------------------------
// ../voice/voice.mjs's renderVoice is already a pure function from a
// VoiceParams object to a complete, deterministic stereo Float32Array pair,
// covering every source type this engine has (sine/triangle/additive/noise/
// karplus-strong/bow-breath) plus filter/noiseMix/saturation/pan. This
// adapter's engine (see ./audio-engine.mjs) calls renderVoice synchronously
// at play time, wraps the result in an AudioBuffer (./voice-buffer.mjs), and
// plays it through an AudioBufferSourceNode -- it does not translate
// VoiceParams into a bespoke tree of OscillatorNode/BiquadFilterNode/
// WaveShaperNode objects.
//
// That was a deliberate choice over the alternative (map each source type
// onto native AudioNodes, e.g. OscillatorNode for sine/triangle,
// BiquadFilterNode for the filter stage, WaveShaperNode for saturation), for
// three reasons:
//   1. One implementation, not two that drift. karplus-strong, bow-breath,
//      and the noise-mix "chiff" texture are all inherently per-sample
//      feedback/state processes (see dsp/karplus-strong.mjs, dsp/
//      bow-breath-voice.mjs) with no native WebAudio node equivalent short
//      of an AudioWorklet -- which would need its own from-scratch
//      reimplementation of that DSP in worklet-scoped JS, run through a
//      *third* code path with its own chance of silently diverging from the
//      node-tested one. Rendering through the exact same renderVoice used
//      everywhere else in this package (and covered by src/voice/voice.test.mts)
//      means every source type, including those, gets WebAudio playback for
//      free and byte-identical to its offline render -- the same
//      determinism guarantee this whole engine is built around, now also
//      true in the browser.
//   2. Game cues are short. This engine's target use (the game-audio kit in
//      ../game/) is one-shot UI/impact/chime/coin/fanfare cues and loopable
//      ambient beds -- durations of tens of milliseconds to low seconds.
//      Rendering that many samples of pure JS math synchronously at trigger
//      time is not a meaningfully measurable cost next to a network request
//      or even a single frame's layout, and does not need to be streamed.
//   3. No AudioWorklet dependency. AudioWorklet requires a separate module
//      file loaded asynchronously into a dedicated realm with no access to
//      most of this package's normal module graph, which would fragment the
//      "voice preset as portable JSON data" story ../voice/voice.mjs's own
//      header describes -- a worklet-based path would need its own
//      parallel copy of the DSP core bundled for that realm.
// The tradeoff this accepts: no live, continuous native-node automation of
// an in-flight voice (e.g. sweeping a filter cutoff on a note that's already
// playing) -- a voice's parameters are fixed at render time, same as they
// already are for renderVoice's node/offline callers. Game cues that want a
// swept/rising character (this package's riser/anticipation primitive, see
// ../game/anticipation.mjs) get it by scheduling many short discrete voices
// with a changing freqHz/gain across their span -- a granular approach, not
// continuous native automation -- which is unaffected by this tradeoff.
// What *does* get real native automation: the mixer -- master/channel
// GainNodes and the duck-channel ramp (see ./audio-engine.mjs's
// duckChannel) are genuine AudioParam automation, not baked into any
// rendered buffer, since that operates across voices/cues rather than
// inside one.
//
// See ./audio-engine.mjs's header for the lazy-AudioContext/autoplay-policy
// and silent-degradation contracts, and for the schedule()/playSpec()
// event-stream seam this adapter exposes for an externally-supplied timed
// event stream (this package's own ../game/ cue system today; a richer
// external performance/composition engine later) to be played without this
// module changing.

export { createAudioEngine } from './audio-engine.mjs';
export { buildMasterBus, buildChannelBuses, connectBufferSource, DEFAULT_CHANNELS } from './graph.mjs';
export { renderedVoiceToAudioBuffer } from './voice-buffer.mjs';
export { makeInMemoryStorage, makeDefaultMixerState, loadMixerState, saveMixerState, DEFAULT_STORAGE_KEY } from './persistence.mjs';
