// src/types/audio-worklet.d.ts
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

interface AudioWorkletGlobalScope {
  registerProcessor: typeof registerProcessor;
}

declare var currentFrame: number;
declare var currentTime: number;
declare var sampleRate: number;
declare var globalThis: AudioWorkletGlobalScope;
