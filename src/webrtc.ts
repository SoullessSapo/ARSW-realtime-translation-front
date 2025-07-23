// src/webrtc.ts
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: process.env.REACT_APP_STUN_URL!.split(",") },
];
