import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import styles from "./VideoCall.module.css";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Tooltip,
  IconButton,
  Typography,
  Paper,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { motion } from "framer-motion";
import { useSnackbar } from "notistack";
import Grid from "@mui/material/Grid";

const SIGNAL_SERVER = process.env.REACT_APP_API_URL;

type Props = {
  userId: string;
  meetingId: string;
  onLeave: () => void;
};

type Participant = {
  id: string;
  name: string;
  stream?: MediaStream;
  speaking?: boolean;
};

export default function VideoCall({ userId, meetingId, onLeave }: Props) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [configOpen, setConfigOpen] = useState(true);
  const [enableCamera, setEnableCamera] = useState(true);
  const [enableMic, setEnableMic] = useState(true);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [inCall, setInCall] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  async function initializeCall() {
    try {
      const socket = io(SIGNAL_SERVER!, { query: { userId } });
      socketRef.current = socket;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: enableCamera,
        audio: enableMic,
      });

      setLocalStream(stream);
      setCameraEnabled(enableCamera);
      setMicEnabled(enableMic);

      if (localVideo.current) localVideo.current.srcObject = stream;

      socket.emit("join-call", { meetingId });

      pcRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      stream.getTracks().forEach((track) => {
        pcRef.current?.addTrack(track, stream);
      });

      pcRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("signal", {
            meetingId,
            signal: { candidate: e.candidate },
            toUserId: "all",
          });
        }
      };

      pcRef.current.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
        if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
      };

      socket.on("signal", async ({ fromUserId, signal }) => {
        if (signal.offer) {
          await pcRef.current?.setRemoteDescription(
            new RTCSessionDescription(signal.offer)
          );
          const answer = await pcRef.current?.createAnswer();
          await pcRef.current?.setLocalDescription(answer!);
          socket.emit("signal", {
            meetingId,
            signal: { answer },
            toUserId: fromUserId,
          });
        } else if (signal.answer) {
          await pcRef.current?.setRemoteDescription(
            new RTCSessionDescription(signal.answer)
          );
        } else if (signal.candidate) {
          await pcRef.current?.addIceCandidate(
            new RTCIceCandidate(signal.candidate)
          );
        }
      });

      // manejar participantes y speaking
      socket.on("user-joined-call", ({ userId, userName }) => {
        setParticipants((prev) => [...prev, { id: userId, name: userName }]);
      });

      socket.on("user-speaking", ({ userId, speaking }) => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, speaking } : p))
        );
      });

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setInterval(() => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const speaking = data.some((v) => v > 60);
        socket.emit("user-speaking", { userId, speaking });
      }, 300);

      setInCall(true);
    } catch (error) {
      enqueueSnackbar("No se pudo iniciar la llamada", { variant: "error" });
      setConfigOpen(true);
    }
  }

  async function startCall() {
    if (pcRef.current) {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socketRef.current?.emit("signal", {
        meetingId,
        signal: { offer },
        toUserId: "all",
      });
    }
  }

  function handleConfirmConfig() {
    setConfigOpen(false);
    initializeCall();
  }

  function toggleMic() {
    const tracks = localStream?.getAudioTracks();
    if (tracks && tracks.length > 0) {
      const enabled = tracks[0].enabled;
      tracks.forEach((track) => (track.enabled = !enabled));
      setMicEnabled(!enabled);
    }
  }

  function toggleCamera() {
    const tracks = localStream?.getVideoTracks();
    if (tracks && tracks.length > 0) {
      const enabled = tracks[0].enabled;
      tracks.forEach((track) => (track.enabled = !enabled));
      setCameraEnabled(!enabled);
    }
  }

  function endCall() {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    setConfigOpen(true);
    enqueueSnackbar("La llamada ha terminado", { variant: "info" });
    onLeave();
  }

  return (
    <>
      <Dialog open={configOpen} maxWidth="xs" fullWidth>
        <DialogTitle>Join with settings</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={enableCamera}
                onChange={(e) => setEnableCamera(e.target.checked)}
              />
            }
            label="Enable camera"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={enableMic}
                onChange={(e) => setEnableMic(e.target.checked)}
              />
            }
            label="Enable microphone"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmConfig} variant="contained">
            Join Meeting
          </Button>
        </DialogActions>
      </Dialog>

      <motion.div
        className={styles.videoCallContainer}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Typography variant="h4" className={styles.videoCallTitle}>
          Live Meeting
        </Typography>

        <Grid
          display="grid"
          gridTemplateColumns={{
            xs: "1fr",
            sm: "1fr 1fr",
            md: "1fr 1fr 1fr",
          }}
          gap={2}
        >
          {participants.map((p) => (
            <Grid key={p.id}>
              <Paper
                className={`${styles.videoBox} ${
                  p.speaking ? styles.speaking : ""
                }`}
              >
                <div className={styles.participantInitial}>
                  {p.name?.[0]?.toUpperCase() || "?"}
                </div>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <Tooltip title={micEnabled ? "Mute" : "Unmute"}>
            <IconButton onClick={toggleMic} color="primary">
              {micEnabled ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={cameraEnabled ? "Turn off camera" : "Turn on camera"}>
            <IconButton onClick={toggleCamera} color="primary">
              {cameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="End Call">
            <IconButton onClick={endCall} color="error">
              <CallEndIcon />
            </IconButton>
          </Tooltip>
        </div>
      </motion.div>
    </>
  );
}
