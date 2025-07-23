// src/hooks/useCallRoom.ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ----------------- CONFIG -----------------
const SIGNALING_URL = "http://localhost:3001";
const TRANSLATE_URL = "http://localhost:3001";
const SAMPLE_RATE = 16000; // Azure espera 16 kHz
const FRAME_MS = 100; // ~100 ms -> 1600 samples
const SILENCE_RMS = 250; // 0 para desactivar filtro de silencio
// ------------------------------------------

// Tipos utilitarios (ajusta si los tienes en otro archivo)
type PeerMap = Map<string, RTCPeerConnection>;
type StreamMap = Map<string, MediaStream>;
type IceQueueMap = Map<string, any[]>;
type OfferSet = Set<string>;
type SdpMap = Map<string, string>;
type UserInfo = { id: string; name?: string; email?: string };

const getUserId = (u: any) =>
  typeof u === "string" ? u : u?.id || u?.userId || "";
const getUserName = (u: any) => u?.name || u?.username || u?.email || "";

// ===================== PCM SENDER =====================
type PcmSender = {
  start: () => Promise<void>;
  stop: () => void;
  running: () => boolean;
};

const createPcmSender = (opts: {
  socket: Socket;
  mediaStream: MediaStream;
  sampleRate?: number;
  frameMs?: number;
  silenceRms?: number;
}): PcmSender => {
  const {
    socket,
    mediaStream,
    sampleRate = SAMPLE_RATE,
    frameMs = FRAME_MS,
    silenceRms = SILENCE_RMS,
  } = opts;

  let ctx: AudioContext;
  let src: MediaStreamAudioSourceNode;
  let proc: ScriptProcessorNode;
  let run = false;

  const TARGET = Math.round((sampleRate * frameMs) / 1000);
  const fifo: Int16Array[] = [];

  const toInt16 = (f32: Float32Array) => {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let s = f32[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  // Downsample naive (asume input 48k → 16k). Ajusta si tu contexto ya es 16k.
  const downSample = (f32: Float32Array, inRate: number, outRate: number) => {
    if (inRate === outRate) return f32;
    const factor = inRate / outRate;
    const outLen = Math.round(f32.length / factor);
    const out = new Float32Array(outLen);
    let idx = 0;
    for (let i = 0; i < outLen; i++) {
      out[i] = f32[Math.floor(idx)];
      idx += factor;
    }
    return out;
  };

  const pushChunk = (pcm16: Int16Array) => {
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
      if (run) return;
      run = true;

      ctx = new AudioContext({ sampleRate });
      src = ctx.createMediaStreamSource(mediaStream);
      proc = ctx.createScriptProcessor(2048, 1, 1);

      proc.onaudioprocess = (e) => {
        if (!run) return;
        const inRate = ctx.sampleRate;
        const data = e.inputBuffer.getChannelData(0);
        const ds = downSample(data, inRate, sampleRate);
        pushChunk(toInt16(ds));
      };

      src.connect(proc);
      proc.connect(ctx.destination);
    },
    stop: () => {
      if (!run) return;
      run = false;
      proc.disconnect();
      src.disconnect();
      socket.emit("end-audio");
      mediaStream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
    running: () => run,
  };
};

// ===================== HOOK PRINCIPAL =====================
export const useCallRoom = (
  meetingId: string,
  myId: string,
  opts?: { meetingName?: string; myName?: string }
) => {
  // Estado UI
  const [connected, setConnected] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);

  const [meetingName, setMeetingName] = useState(
    opts?.meetingName || "Reunión"
  );
  const [myName, setMyName] = useState(opts?.myName || "Yo");

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const peersRef = useRef<PeerMap>(new Map());
  const remoteStreamsRef = useRef<StreamMap>(new Map());
  const pendingIce = useRef<IceQueueMap>(new Map());
  const offeredTo = useRef<OfferSet>(new Set());
  const lastRemoteSdp = useRef<SdpMap>(new Map());
  const lastLocalSdp = useRef<SdpMap>(new Map());
  const usersRef = useRef<Map<string, UserInfo>>(new Map());

  // Traducción
  const translateSocketRef = useRef<Socket | null>(null);
  const pcmSenderRef = useRef<PcmSender | null>(null);
  const [translatedCaption, setTranslatedCaption] = useState("");
  const [partialCaption, setPartialCaption] = useState("");

  const translatedCtxRef = useRef<AudioContext | null>(null);
  const translatedDestRef = useRef<MediaStreamAudioDestinationNode | null>(
    null
  );
  const [translatedStream, setTranslatedStream] = useState<MediaStream | null>(
    null
  );

  // Logger
  const log = (...args: any[]) => {
    const line = args
      .map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)))
      .join(" ");
    console.log("[CallRoom]", ...args);
    setLogLines((prev) => [...prev.slice(-100), line]);
  };

  // Init
  useEffect(() => {
    (async () => {
      // Cam/Mic local
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;

      // Socket signaling
      const socket = io(SIGNALING_URL + "/signal", {
        transports: ["websocket"],
        query: { userId: myId },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        log("✅ conectado", socket.id);
        setConnected(true);
        socket.emit("join-call", { meetingId, userId: myId });
      });

      socket.on("existing-participants", async (payload: any) => {
        const raw = Array.isArray(payload) ? payload : payload?.users ?? [];
        const list = raw
          .map((u: any) => {
            const id = getUserId(u);
            if (!id) return "";
            usersRef.current.set(id, {
              id,
              name: getUserName(u),
              email: u?.email,
            });
            return id;
          })
          .filter(Boolean);

        setWaitingUsers(list.filter((u: string) => u !== myId));
        for (const uid of list) {
          if (uid === myId) continue;
          await createOfferFor(uid);
        }
      });

      socket.on("webrtc-offer", async (raw: any) => {
        const desc: RTCSessionDescriptionInit = { type: "offer", sdp: raw.sdp };
        if (!desc.sdp) return;
        const fromUserId = getUserId(raw.fromUserId);
        const fromUserName = raw.fromUserName || getUserName(raw.fromUser);

        if (fromUserId) {
          usersRef.current.set(fromUserId, {
            id: fromUserId,
            name: fromUserName,
          });
        }

        const pc = await ensurePeer(fromUserId);
        await safeSetRemote(pc, fromUserId, desc);
        flushIce(fromUserId, pc);

        const answer = await safeCreateAndSetAnswer(pc, fromUserId);
        if (!answer) return;

        socket.emit("webrtc-answer", {
          meetingId,
          toUserId: fromUserId,
          sdp: answer.sdp!,
          type: answer.type,
        });
      });

      socket.on("webrtc-answer", async (raw: any) => {
        const desc: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: raw.sdp,
        };
        if (!desc.sdp) return;
        const fromUserId = getUserId(raw.fromUserId);

        const pc = peersRef.current.get(fromUserId);
        if (!pc) return;

        if (pc.signalingState === "have-local-offer") {
          await safeSetRemote(pc, fromUserId, desc);
          flushIce(fromUserId, pc);
        } else {
          log("⚠️ Ignorado answer state=", pc.signalingState);
        }
      });

      socket.on("webrtc-ice-candidate", ({ fromUserId, candidate }: any) => {
        const uid = getUserId(fromUserId);
        const pc = peersRef.current.get(uid);
        if (!pc || !candidate) return;

        if (!pc.remoteDescription) {
          const arr = pendingIce.current.get(uid) ?? [];
          arr.push(candidate);
          pendingIce.current.set(uid, arr);
          return;
        }
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      socket.on("user-left-call", ({ userId }: { userId: string }) => {
        destroyPeer(userId);
        setWaitingUsers((w) => w.filter((x) => x !== userId));
      });

      socket.on("disconnect", () => setConnected(false));
    })();

    return () => {
      leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, myId]);

  // ---- Helpers WebRTC ----
  const flushIce = (uid: string, pc: RTCPeerConnection) => {
    const arr = pendingIce.current.get(uid);
    if (arr?.length) {
      arr.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
      pendingIce.current.delete(uid);
    }
  };

  const safeSetRemote = async (
    pc: RTCPeerConnection,
    uid: string,
    desc: RTCSessionDescriptionInit
  ) => {
    if (lastRemoteSdp.current.get(uid) === desc.sdp) return;
    if (desc.type === "offer" && pc.signalingState !== "stable") {
      // @ts-ignore
      await pc.setLocalDescription({ type: "rollback" });
    }
    if (desc.type === "answer" && pc.signalingState !== "have-local-offer")
      return;
    await pc.setRemoteDescription(desc);
    lastRemoteSdp.current.set(uid, desc.sdp!);
  };

  const safeCreateAndSetAnswer = async (pc: RTCPeerConnection, uid: string) => {
    if (pc.signalingState !== "have-remote-offer") return null;
    const answer = await pc.createAnswer();
    if (lastLocalSdp.current.get(uid) === answer.sdp) return null;
    await pc.setLocalDescription(answer);
    lastLocalSdp.current.set(uid, answer.sdp!);
    return answer;
  };

  const ensurePeer = async (
    otherUserId: string
  ): Promise<RTCPeerConnection> => {
    let pc = peersRef.current.get(otherUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    getCurrentOutgoingStreams().forEach((st) =>
      st.getTracks().forEach((t) => pc!.addTrack(t, st))
    );

    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(otherUserId, remoteStream);

    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
      setWaitingUsers((w) => w.filter((x) => x !== otherUserId));
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketRef.current?.emit("webrtc-ice-candidate", {
          meetingId,
          toUserId: otherUserId,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc!.connectionState === "disconnected" ||
        pc!.connectionState === "failed"
      ) {
        destroyPeer(otherUserId);
      }
    };

    peersRef.current.set(otherUserId, pc);
    return pc;
  };

  const destroyPeer = (otherUserId: string) => {
    const pc = peersRef.current.get(otherUserId);
    pc?.close();
    peersRef.current.delete(otherUserId);
    remoteStreamsRef.current.delete(otherUserId);
    pendingIce.current.delete(otherUserId);
    lastRemoteSdp.current.delete(otherUserId);
    lastLocalSdp.current.delete(otherUserId);
    offeredTo.current.delete(otherUserId);
  };

  const createOfferFor = async (toUserId: string) => {
    if (offeredTo.current.has(toUserId)) return;
    offeredTo.current.add(toUserId);

    const pc = await ensurePeer(toUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit("webrtc-offer", {
      meetingId,
      toUserId,
      sdp: offer.sdp!,
      type: offer.type,
      fromUserName: myName,
    });
  };

  // ---- Controles locales ----
  const toggleMic = () => {
    const enabled = !micOn;
    setMicOn(enabled);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = enabled));
  };

  const toggleCam = () => {
    const enabled = !camOn;
    setCamOn(enabled);
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = enabled));
  };

  const startShare = async () => {
    if (sharing) return;
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      setSharing(true);
      replaceOutgoingVideoTrack(stream.getVideoTracks()[0]);
      stream.getVideoTracks()[0].onended = () => stopShare();
    } catch (e) {
      log("❌ error al compartir pantalla", e);
    }
  };

  const stopShare = () => {
    if (!sharing) return;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setSharing(false);

    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    if (camTrack) replaceOutgoingVideoTrack(camTrack);
  };

  // ---- Traducción ----
  const toggleTranslate = async () => {
    if (!translateOn) {
      // Socket traducción
      translateSocketRef.current = io(TRANSLATE_URL + "/traducir", {
        transports: ["websocket"],
        forceNew: true,
      });

      translateSocketRef.current.on("translated-text-partial", (t: string) =>
        setPartialCaption(t)
      );
      translateSocketRef.current.on(
        "translated-text",
        ({ text }: { text: string }) => {
          setTranslatedCaption(text);
          setPartialCaption("");
        }
      );

      translateSocketRef.current.on(
        "translated-audio",
        async (buf: ArrayBuffer) => {
          if (!translatedCtxRef.current) {
            translatedCtxRef.current = new AudioContext();
            translatedDestRef.current =
              translatedCtxRef.current.createMediaStreamDestination();
            setTranslatedStream(translatedDestRef.current.stream);
          }
          const ctx = translatedCtxRef.current!;
          const audioBuf = await ctx.decodeAudioData(buf.slice(0));
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(translatedDestRef.current!);
          src.start();
        }
      );

      // Envío de audio PCM
      const mic = localStreamRef.current;
      if (!mic) return;
      pcmSenderRef.current = createPcmSender({
        socket: translateSocketRef.current,
        mediaStream: mic,
        sampleRate: SAMPLE_RATE,
        frameMs: FRAME_MS,
        silenceRms: SILENCE_RMS,
      });
      await pcmSenderRef.current.start();

      // Silencia micro original y reemplaza por traducido (si quieres que los demás oigan la traducción)
      localStreamRef.current
        ?.getAudioTracks()
        .forEach((t) => (t.enabled = false));
      const newTrack = translatedStream?.getAudioTracks()[0];
      if (newTrack) {
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) sender.replaceTrack(newTrack);
        });
      }

      setTranslateOn(true);
    } else {
      // Detener
      pcmSenderRef.current?.stop();
      translateSocketRef.current?.disconnect();
      pcmSenderRef.current = null;
      translateSocketRef.current = null;

      translatedCtxRef.current?.close();
      translatedCtxRef.current = null;
      translatedDestRef.current = null;
      setTranslatedStream(null);

      // Regresar micro original
      localStreamRef.current
        ?.getAudioTracks()
        .forEach((t) => (t.enabled = true));
      const orig = localStreamRef.current?.getAudioTracks()[0];
      if (orig) {
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) sender.replaceTrack(orig);
        });
      }

      setTranslateOn(false);
    }
  };

  const leaveCall = () => {
    socketRef.current?.emit("leave-call", { meetingId });
    socketRef.current?.disconnect();

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIce.current.clear();
    lastRemoteSdp.current.clear();
    lastLocalSdp.current.clear();
    offeredTo.current.clear();
  };

  const replaceOutgoingVideoTrack = (newTrack: MediaStreamTrack) => {
    peersRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "video") {
          sender.replaceTrack(newTrack);
        }
      });
    });
  };

  const getCurrentOutgoingStreams = (): MediaStream[] => {
    const streams: MediaStream[] = [];
    if (localStreamRef.current) streams.push(localStreamRef.current);
    if (screenStreamRef.current) streams.push(screenStreamRef.current);
    return streams;
  };

  const getUserDisplayName = (id: string) =>
    usersRef.current.get(id)?.name || id.slice(0, 8);

  // Retorno del hook
  return {
    // estado
    connected,
    logLines,
    waitingUsers,
    micOn,
    camOn,
    sharing,
    translateOn,
    translatedCaption,
    partialCaption,
    meetingName,
    myName,

    // refs/streams
    remoteStreamsRef,
    localStreamRef,
    screenStreamRef,

    // acciones
    toggleMic,
    toggleCam,
    startShare,
    stopShare,
    leaveCall,
    toggleTranslate,

    // helpers
    getUserDisplayName,
  };
};
