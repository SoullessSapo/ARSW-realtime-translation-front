import React from "react";

interface Props {
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  translateOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onShare: () => void;
  onStopShare: () => void;
  onLeave: () => void;
  onToggleTranslate: () => void;
}

const ControlBar: React.FC<Props> = ({
  micOn,
  camOn,
  sharing,
  translateOn,
  onToggleMic,
  onToggleCam,
  onShare,
  onStopShare,
  onLeave,
  onToggleTranslate,
}) => (
  <div className="control-bar">
    <button className="btn" onClick={onToggleMic}>
      {micOn ? "🔊 Mutear" : "🔇 Activar mic"}
    </button>
    <button className="btn" onClick={onToggleCam}>
      {camOn ? "📷 Apagar cam" : "📷 Encender cam"}
    </button>
    {!sharing ? (
      <button className="btn" onClick={onShare}>
        🖥️ Compartir pantalla
      </button>
    ) : (
      <button className="btn" onClick={onStopShare}>
        🛑 Parar compartir
      </button>
    )}
    <button className="btn" onClick={onToggleTranslate}>
      {translateOn ? "🛑 Detener traducción" : "🌐 Traducir mi voz"}
    </button>
    <button className="btn btn--danger" onClick={onLeave}>
      🚪 Salir
    </button>
  </div>
);

export default ControlBar;
