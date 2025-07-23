export interface UserInfo {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export type PeerMap = Map<string, RTCPeerConnection>;
export type StreamMap = Map<string, MediaStream>;
export type IceQueueMap = Map<string, RTCIceCandidateInit[]>;
export type OfferSet = Set<string>;
export type SdpMap = Map<string, string>;

export const getUserId = (u: any): string =>
  typeof u === "string" ? u : u?.id || u?.userId || u?.uid || "";

export const getUserName = (u: any): string =>
  typeof u === "string"
    ? u.slice(0, 8)
    : u?.name || u?.username || u?.email || u?.id?.slice(0, 8) || "Usuario";
