// ...existing code...
// src/pages/CallRoom.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import "../styles/callroom.css";
import HeaderBar from "../components/HeaderBar";
import ControlBar from "../components/ControlBar";
import VideoTile from "../components/VideoTile";
import PlaceholderTile from "../components/PlaceholderTile";
import { Subtitles } from "../components/Subtitles";
// import { useAzureTranslation } from "../hooks/useAzureTranslation";
import io, { Socket } from "socket.io-client";

// =========================== CONFIG ===========================
const SIGNALING_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";
// =============================================================

type PeerMap = Map<string, RTCPeerConnection>;
type StreamMap = Map<string, MediaStream>;
type IceQueueMap = Map<string, any[]>;
type OfferSet = Set<string>;
type SdpMap = Map<string, string>;
type UserInfo = { id: string; name?: string; email?: string };

const getUserId = (u: any) =>
  typeof u === "string" ? u : u?.id || u?.userId || "";
const getUserName = (u: any) => u?.name || u?.username || u?.email || "";

// ===================== Hook principal =====================
function useCallRoom(
  meetingId: string,
  myId: string,
  opts?: { meetingName?: string; myName?: string }
) {
  // ----------- Estado UI -----------
  const [connected, setConnected] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  const [meetingName] = useState(opts?.meetingName || "Reunión");
  const [myName] = useState(opts?.myName || "Yo");

  // Refs WebRTC
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

  const log = (...args: any[]) => {
    const line = args
      .map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x)))
      .join(" ");
    console.log("[CallRoom]", ...args);
    setLogLines((prev) => [...prev.slice(-120), line]);
  };

  const getUserDisplayName = (id: string) =>
    usersRef.current.get(id)?.name || id.slice(0, 8);

  // ----------- Init principal -----------
  useEffect(() => {
    (async () => {
      // stream local
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;

      // signaling
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

    return () => leaveCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, myId]);

  // ----------- WebRTC helpers -----------
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

    // añade tracks actuales
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

  const replaceOutgoingVideoTrack = (newTrack: MediaStreamTrack) => {
    peersRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "video")
          sender.replaceTrack(newTrack);
      });
    });
  };

  const getCurrentOutgoingStreams = (): MediaStream[] => {
    const streams: MediaStream[] = [];
    if (localStreamRef.current) streams.push(localStreamRef.current);
    if (screenStreamRef.current) streams.push(screenStreamRef.current);
    return streams;
  };

  // ----------- Controles locales -----------
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

  return {
    connected,
    logLines,
    waitingUsers,
    micOn,
    camOn,
    sharing,
    remoteStreamsRef,
    localStreamRef,
    screenStreamRef,
    toggleMic,
    toggleCam,
    startShare,
    stopShare,
    leaveCall,
    meetingName,
    myName,
    getUserDisplayName,
  };
}

// ===================== Componente =====================
const CallRoom = ({
  meetingId,
  myId,
  meetingName,
  myName,
}: {
  meetingId: string;
  myId: string;
  meetingName?: string;
  myName?: string;
}) => {
  // === Estados y refs para traducción ===
  const [isTranslating, setIsTranslating] = useState(false);
  const [original, setOriginal] = useState("");
  const [translated, setTranslated] = useState("");
  const [translationLogs, setTranslationLogs] = useState<string[]>([]);

  const translationSocketRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const speakingRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const chunkBufRef = useRef<Float32Array[]>([]);
  const localTranslationStreamRef = useRef<MediaStream | null>(null);

  // === Constantes de traducción ===
  const TRANSLATION_NS = `${process.env.REACT_APP_API_URL}/traducir`;
  const SAMPLE_RATE = 16000;
  const SILENCE_MS = 1000;
  const THRESHOLD = 0.01;

  // === Utils ===
  const logTranslation = (m: string) =>
    setTranslationLogs((prev) => [
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
  const rms = (buf: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  // === Funciones de traducción ===
  const startAzure = async () => {
    logTranslation("Intentando emitir azure:start");
    if (!translationSocketRef.current) {
      logTranslation("[ERROR] socketRef.current es null en startAzure");
      return;
    }
    translationSocketRef.current.emit("azure:start", {
      from: "es-ES",
      to: "en-US",
      sampleRate: SAMPLE_RATE,
    });
    logTranslation("Emitido azure:start");
  };

  const sendChunk = () => {
    if (!translationSocketRef.current) {
      logTranslation("[ERROR] socketRef.current es null en sendChunk");
      return;
    }
    if (!chunkBufRef.current.length) {
      logTranslation("[WARN] No hay chunks para enviar");
      return;
    }
    const float32 = mergeFloat32(chunkBufRef.current);
    chunkBufRef.current = [];
    const pcm16 = floatTo16BitPCM(float32);
    logTranslation(
      `Enviando paquete de ${pcm16.byteLength} bytes a azure:chunk`
    );
    translationSocketRef.current.emit("azure:chunk", pcm16.buffer);
    translationSocketRef.current.emit("azure:stop");
    logTranslation("Emitido azure:stop tras azure:chunk");
  };

  const startTranslation = async (mediaStream?: MediaStream) => {
    console.log(mediaStream);
    console.log("[CallRoom] startTranslation ejecutado", {
      isTranslating,
    });
    if (isTranslating) {
      logTranslation("[INFO] Ya está traduciendo, no se inicia de nuevo");
      return;
    }
    logTranslation("Iniciando traducción y conectando socket...");
    translationSocketRef.current = io(TRANSLATION_NS, {
      transports: ["websocket"],
    });
    translationSocketRef.current.on("connect", () =>
      logTranslation("Socket conectado")
    );
    translationSocketRef.current.on("azure:ready", () =>
      logTranslation("Azure listo")
    );
    translationSocketRef.current.on("azure:error", (e: any) =>
      logTranslation("Azure error: " + JSON.stringify(e))
    );
    translationSocketRef.current.on("translationResult", (data: any) => {
      logTranslation(`Resultado: "${data.original}" -> "${data.translated}"`);
      setOriginal(data.original);
      setTranslated(data.translated);
      if (data.audioBase64) playBase64Wav(data.audioBase64);
    });
    translationSocketRef.current.on("disconnect", () =>
      logTranslation("Socket desconectado")
    );

    await startAzure();

    logTranslation("Creando contexto de audio y capturando micrófono...");
    audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    let stream = mediaStream;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        logTranslation("Obtenido stream de micrófono por getUserMedia");
      } catch (err) {
        logTranslation("[ERROR] No se pudo obtener el micrófono: " + err);
        return;
      }
    } else {
      logTranslation("Usando mediaStream proporcionado");
    }
    localTranslationStreamRef.current = stream;
    const source = audioCtxRef.current.createMediaStreamSource(stream);
    srcRef.current = source;
    const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;

    processor.onaudioprocess = (e) => {
      const pcm = e.inputBuffer.getChannelData(0);
      const energy = rms(pcm);
      chunkBufRef.current.push(new Float32Array(pcm));
      logTranslation(`Procesado audio, energía: ${energy}`);
      if (energy > THRESHOLD) {
        speakingRef.current = true;
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (speakingRef.current && !silenceTimerRef.current) {
        silenceTimerRef.current = window.setTimeout(() => {
          speakingRef.current = false;
          logTranslation("Detectado silencio, enviando chunk...");
          sendChunk();
        }, SILENCE_MS) as unknown as number;
      }
    };

    source.connect(processor);
    processor.connect(audioCtxRef.current.destination);
    setIsTranslating(true);
    logTranslation("Captura iniciada y procesador conectado");
  };

  const stopTranslation = () => {
    if (!isTranslating) return;
    procRef.current?.disconnect();
    srcRef.current?.disconnect();
    audioCtxRef.current?.close();
    procRef.current = null;
    srcRef.current = null;
    audioCtxRef.current = null;
    translationSocketRef.current?.disconnect();
    translationSocketRef.current = null;
    setIsTranslating(false);
    logTranslation("Captura detenida");
  };

  // Usa el hook de sala normalmente
  const {
    connected,
    logLines,
    waitingUsers,
    micOn,
    camOn,
    sharing,
    remoteStreamsRef,
    localStreamRef,
    screenStreamRef,
    toggleMic,
    toggleCam,
    startShare,
    stopShare,
    leaveCall,
    meetingName: mName,
    myName: mUser,
    getUserDisplayName,
  } = useCallRoom(meetingId, myId, { meetingName, myName });

  // === Muteo de audio solo para la llamada (no para traducción) ===
  const muteCallAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
      stream.removeTrack(track);
    });
  };

  const unmuteCallAudio = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    if (stream.getAudioTracks().length === 0) {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const audioTrack = micStream.getAudioTracks()[0];
      stream.addTrack(audioTrack);
    }
  };

  // Nueva función para el botón traducir
  const handleToggleTranslate = useCallback(async () => {
    console.log("[CallRoom] handleToggleTranslate ejecutado", {
      isTranslating,
    });
    if (!isTranslating) {
      // Mutea la llamada (quita el audio de localStreamRef), pero deja el audio para traducción
      muteCallAudio();
      await startTranslation(); // SIEMPRE pide un nuevo stream de micrófono
      console.log("[CallRoom] startTranslation llamado");
    } else {
      console.log("[CallRoom] Deteniendo traducción");
      stopTranslation();
      // Vuelve a agregar el audio a la llamada
      await unmuteCallAudio();
      console.log("[CallRoom] stopTranslation llamado");
    }
  }, [
    isTranslating,
    muteCallAudio,
    startTranslation,
    stopTranslation,
    unmuteCallAudio,
  ]);

  return (
    <div className="callroom">
      <HeaderBar meetingName={mName} myName={mUser} connected={connected} />

      <ControlBar
        micOn={micOn}
        camOn={camOn}
        sharing={sharing}
        translateOn={isTranslating}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onShare={startShare}
        onStopShare={stopShare}
        onLeave={leaveCall}
        onToggleTranslate={handleToggleTranslate}
      />

      <div className="video-grid">
        <VideoTile
          stream={sharing ? screenStreamRef.current : localStreamRef.current}
          label={mUser}
          muted
        />

        {[...remoteStreamsRef.current.entries()].map(([uid, stream]) => (
          <VideoTile
            key={uid}
            stream={stream}
            label={getUserDisplayName(uid)}
          />
        ))}

        {waitingUsers.map((uid) => (
          <PlaceholderTile
            key={uid}
            text={`Esperando a ${getUserDisplayName(uid)}...`}
          />
        ))}
      </div>

      <details className="logs">
        <summary>Logs</summary>
        <pre>{logLines.join("\n")}</pre>
        <pre style={{ color: "#0cf", fontSize: 12, marginTop: 8 }}>
          {translationLogs && translationLogs.length > 0
            ? translationLogs.join("\n")
            : "(Sin logs de traducción)"}
        </pre>
      </details>

      <Subtitles text={translated} />
    </div>
  );
};

export default CallRoom;
