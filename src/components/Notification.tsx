import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_API_URL;

export default function Notification({
  userId,
  onNotification,
}: {
  userId: string;
  onNotification: (data: any) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, { query: { userId } });
    socket.on("user-joined", (data) => {
      setMessage(`${data.userName} joined!`);
      onNotification(data);
    });
    socket.on("user-left", (data) => {
      setMessage(`${data.userName} left.`);
      onNotification(data);
    });
    socket.on("friend-request", (data) => {
      setMessage(`${data.requesterName} sent you a friend request!`);
      onNotification(data);
    });
    socket.on("meeting-invitation", (data) => {
      setMessage(`${data.invitedByName} invited you to ${data.meetingTitle}`);
      onNotification(data);
    });
    return () => {
      socket.disconnect();
    };
  }, [userId, onNotification]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-8 z-50">
      <div className="bg-indigo-700 text-white px-6 py-4 rounded-xl shadow-xl text-lg animate-bounce">
        {message}
        <button className="ml-4 font-bold" onClick={() => setMessage(null)}>
          ×
        </button>
      </div>
    </div>
  );
}
