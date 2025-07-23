import { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const TRANSLATION_NS = "http://localhost:3001/traducir";
const SAMPLE_RATE = 16000;
const SILENCE_MS = 1000;
const THRESHOLD = 0.01; // energía mínima para detectar voz

export function useAzureTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [original, setOriginal] = useState("");
  const [translated, setTranslated] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const speakingRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const chunkBufRef = useRef<Float32Array[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

  const log = (m: string) =>
    setLogs((prev) => [
      ...prev.slice(-99),
      `[${new Date().toLocaleTimeString()}] ${m}`,
    ]);

  const playBase64Wav = (b64: string) => {
    const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    const blob = new Blob([buf], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  const startAzure = async () => {
    log("Intentando emitir azure:start");
    if (!socketRef.current) {
      log("[ERROR] socketRef.current es null en startAzure");
      return;
    }
    socketRef.current.emit("azure:start", {
      from: "es-ES", // cambia aquí el idioma si quieres
      to: "en-US",
      sampleRate: SAMPLE_RATE,
    });
    log("Emitido azure:start");
  };

  const sendChunk = () => {
    if (!socketRef.current) {
      log("[ERROR] socketRef.current es null en sendChunk");
      return;
    }
    if (!chunkBufRef.current.length) {
      log("[WARN] No hay chunks para enviar");
      return;
    }
    const float32 = mergeFloat32(chunkBufRef.current);
    chunkBufRef.current = [];
    const pcm16 = floatTo16BitPCM(float32);
    log(`Enviando paquete de ${pcm16.byteLength} bytes a azure:chunk`);
    socketRef.current.emit("azure:chunk", pcm16.buffer);
    socketRef.current.emit("azure:stop");
    log("Emitido azure:stop tras azure:chunk");
  };

  const startTranslation = async (mediaStream?: MediaStream) => {
    if (isTranslating) {
      log("[INFO] Ya está traduciendo, no se inicia de nuevo");
      return;
    }
    log("Iniciando traducción y conectando socket...");
    // 1. Conecta socket
    socketRef.current = io(TRANSLATION_NS, { transports: ["websocket"] });
    socketRef.current.on("connect", () => log("Socket conectado"));
    socketRef.current.on("azure:ready", () => log("Azure listo"));
    socketRef.current.on("azure:error", (e) =>
      log("Azure error: " + JSON.stringify(e))
    );
    socketRef.current.on("translationResult", (data: any) => {
      log(`Resultado: "${data.original}" -> "${data.translated}"`);
      setOriginal(data.original);
      setTranslated(data.translated);
      if (data.audioBase64) playBase64Wav(data.audioBase64);
    });
    socketRef.current.on("disconnect", () => log("Socket desconectado"));

    await startAzure();

    // 2. Audio
    log("Creando contexto de audio y capturando micrófono...");
    audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    let stream = mediaStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log("Obtenido stream de micrófono por getUserMedia");
      } catch (err) {
        log("[ERROR] No se pudo obtener el micrófono: " + err);
        return;
      }
    } else {
      log("Usando mediaStream proporcionado");
    }
    localStreamRef.current = stream;
    const source = audioCtxRef.current.createMediaStreamSource(stream);
    srcRef.current = source;
    const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;

    processor.onaudioprocess = (e) => {
      const pcm = e.inputBuffer.getChannelData(0);
      const energy = rms(pcm);
      chunkBufRef.current.push(new Float32Array(pcm));
      log(`Procesado audio, energía: ${energy}`);
      if (energy > THRESHOLD) {
        speakingRef.current = true;
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (speakingRef.current && !silenceTimerRef.current) {
        silenceTimerRef.current = window.setTimeout(() => {
          speakingRef.current = false;
          log("Detectado silencio, enviando chunk...");
          sendChunk();
        }, SILENCE_MS) as unknown as number;
      }
    };

    source.connect(processor);
    processor.connect(audioCtxRef.current.destination);
    setIsTranslating(true);
    log("Captura iniciada y procesador conectado");
  };

  const stopTranslation = () => {
    if (!isTranslating) return;
    procRef.current?.disconnect();
    srcRef.current?.disconnect();
    audioCtxRef.current?.close();
    procRef.current = null;
    srcRef.current = null;
    audioCtxRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsTranslating(false);
    log("Captura detenida");
  };

  // === Utils ===
  const rms = (buf: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };
  const mergeFloat32 = (chunks: Float32Array[]) => {
    const total = chunks.reduce((t, c) => t + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return merged;
  };
  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  return {
    isTranslating,
    original,
    translated,
    logs,
    startTranslation,
    stopTranslation,
  };
}
