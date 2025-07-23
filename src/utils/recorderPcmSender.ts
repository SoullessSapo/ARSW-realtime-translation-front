// src/utils/recorderPcmSender.ts
import Recorder from "recorder-js";

export type RecorderPcmSender = {
  start: () => Promise<void>;
  stop: () => void;
  isRunning: () => boolean;
};

export function createRecorderPcmSender(opts: {
  socket: any; // socket.io client
  sampleRate?: number; // 16000
  frameSizeMs?: number; // 100 -> 1600 samples
  silenceRms?: number; // 0 = deshabilitado
}): RecorderPcmSender {
  const {
    socket,
    sampleRate = 16000,
    frameSizeMs = 100,
    silenceRms = 0,
  } = opts;

  let running = false;
  let audioCtx: AudioContext;
  let recorder: any;
  let mediaStream: MediaStream;
  let fifo: Int16Array[] = [];
  const TARGET = Math.round((sampleRate * frameSizeMs) / 1000);

  const toInt16 = (float32: Float32Array) => {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = float32[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const processChunk = (floatChunk: Float32Array) => {
    const pcm16 = toInt16(floatChunk);

    if (silenceRms > 0) {
      let sum = 0;
      for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
      const rms = Math.sqrt(sum / pcm16.length);
      if (rms < silenceRms) return;
    }

    fifo.push(pcm16);
    let total = fifo.reduce((n, a) => n + a.length, 0);
    while (total >= TARGET) {
      const out = new Int16Array(TARGET);
      let off = 0;
      while (off < TARGET && fifo.length) {
        const head = fifo[0];
        const need = TARGET - off;
        if (head.length <= need) {
          out.set(head, off);
          off += head.length;
          fifo.shift();
        } else {
          out.set(head.subarray(0, need), off);
          fifo[0] = head.subarray(need);
          off += need;
        }
      }
      total -= TARGET;
      socket.emit("audio-chunk", out.buffer, { compress: false });
    }
  };

  return {
    start: async () => {
      if (running) return;
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      audioCtx = new AudioContext({ sampleRate });

      recorder = new Recorder(audioCtx, {});
      recorder.init(mediaStream);

      // Hack: usamos el ScriptProcessor interno del recorder para sacar frames
      const sp: ScriptProcessorNode = (recorder as any)._scriptNode;
      sp.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!running) return;
        const input = e.inputBuffer.getChannelData(0); // Float32Array
        processChunk(input);
      };

      recorder.start(); // inicia el processor
      running = true;
    },
    stop: () => {
      if (!running) return;
      running = false;
      recorder?.stop();
      socket.emit("end-audio");
      mediaStream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    },
    isRunning: () => running,
  };
}
