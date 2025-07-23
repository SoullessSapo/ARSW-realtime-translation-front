import React, { useEffect, useRef } from "react";

const VideoTile: React.FC<{
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}> = ({ stream, label, muted = false }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="tile">
      <video ref={ref} autoPlay playsInline muted={muted} />
      <div className="tile__label">{label}</div>
    </div>
  );
};

export default VideoTile;
