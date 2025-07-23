import React from "react";

interface Props {
  meetingName: string;
  myName: string;
  connected: boolean;
}

const HeaderBar: React.FC<Props> = ({ meetingName, myName, connected }) => (
  <div className="header">
    <div className="header__left">
      <h1 className="header__title">{meetingName}</h1>
      <span className={`header__status ${connected ? "on" : "off"}`}>
        {connected ? "Conectado" : "Desconectado"}
      </span>
    </div>
    <div className="header__right">
      <span className="header__me">👤 {myName}</span>
    </div>
  </div>
);

export default HeaderBar;
