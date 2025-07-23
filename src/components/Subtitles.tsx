import React from "react";

export const Subtitles: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div className="subtitles">
      <span className="subtitles__bubble">{text}</span>
    </div>
  );
};
