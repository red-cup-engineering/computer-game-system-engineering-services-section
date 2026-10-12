// Type declarations for @red-cup-engineering/resonator/voice.

export type PartialsField =
  | string
  | { count: number; rolloffExponent?: number; oddEvenBias?: number }
  | Array<{ ratio: number; amp: number }>;

export interface VoiceSource {
  type: 'sine' | 'triangle' | 'additive' | 'noise' | 'karplus-strong' | 'bow-breath';
  partials?: PartialsField;
  color?: 'white' | 'filtered';
  cutoffHz?: number;
  decay?: number;
  dampingHz?: number;
  exciteGain?: number;
  shape?: string | Record<string, number>;
}

export interface VoiceEnvelope {
  attackSec: number;
  releaseSec: number;
  sustainLevel: number;
  curve?: number;
  releaseAtSec?: number;
}

export interface VoiceFilter {
  type: 'lowpass' | 'highpass' | 'bandpass';
  cutoffHz: number;
  Q?: number;
}

export interface VoiceNoiseMix {
  amount: number;
  cutoffHz?: number;
}

export interface VoiceSaturation {
  drive?: number;
  asymmetryBias?: number;
  mix?: number;
}

export interface VoiceParams {
  freqHz: number;
  durationSec: number;
  source: VoiceSource;
  envelope: VoiceEnvelope;
  filter?: VoiceFilter;
  noiseMix?: VoiceNoiseMix;
  saturation?: VoiceSaturation;
  gain?: number;
  pan?: number;
  sampleRate?: number;
  seed?: number | string;
}

export interface RenderedVoice {
  sampleRate: number;
  durationSec: number;
  numSamples: number;
  left: Float32Array;
  right: Float32Array;
}

export function renderVoice(params: VoiceParams, opts?: { sampleRate?: number }): RenderedVoice;
