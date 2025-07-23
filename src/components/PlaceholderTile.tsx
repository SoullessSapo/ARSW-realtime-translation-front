import React from "react";

const PlaceholderTile: React.FC<{ text: string }> = ({ text }) => (
  <div className="placeholder">{text}</div>
);

export default PlaceholderTile;
