import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import styles from "./NotificationPanel.module.css";
import { Tooltip, IconButton, Button } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { motion, AnimatePresence } from "framer-motion";

const SOCKET_URL = process.env.REACT_APP_API_URL;

type Notification = {
  msg: string;
  id: number;
  type?: string;
  requesterId?: string;
};

interface NotificationPanelProps {
  userId: string;
}

export default function NotificationPanel({ userId }: NotificationPanelProps) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(sessionStorage.getItem("token"));
  }, []);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL!, { query: { userId } });
    let i = 0;
    const push = (msg: string, type?: string, extra?: any) =>
      setNotifs((n) => [{ msg, id: ++i, type, ...extra }, ...n]);

    socket.on("user-joined", (data) => push(`${data.userName} joined!`));
    socket.on("user-left", (data) => push(`${data.userName} left.`));
    socket.on("friend-request", (data) =>
      push(`${data.requesterName} sent you a friend request!`, "friend", {
        requesterId: data.requesterId,
      })
    );
    socket.on("meeting-invitation", (data) =>
      push(`${data.invitedByName} invited you to ${data.meetingTitle}`)
    );

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // Accept friend request handler
  const handleAcceptFriend = async (requesterId: string, notifId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${SOCKET_URL}/friendship/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requesterId }),
      });
      if (res.ok) {
        setNotifs((n) => n.filter((notif) => notif.id !== notifId));
      } else {
        alert("No se pudo aceptar la solicitud.");
      }
    } catch (err) {
      alert("Error al aceptar la solicitud.");
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <IconButton
        onClick={() => setOpen((v) => !v)}
        size="large"
        style={{ position: "relative", zIndex: 1100 }}
      >
        <NotificationsIcon fontSize="medium" />
        {notifs.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              width: 18,
              height: 18,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            {notifs.length}
          </span>
        )}
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panelRoot}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                <NotificationsIcon
                  sx={{ verticalAlign: "middle", mr: 1 }}
                  fontSize="small"
                />
                Notifications
              </span>
              <Tooltip title="Clear all">
                <IconButton
                  className={styles.panelClearBtn}
                  onClick={() => setNotifs([])}
                  size="small"
                >
                  <ClearAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>

            <ul className={styles.panelList}>
              {notifs.length === 0 && (
                <li className="text-gray-400 text-sm py-1">No notifications</li>
              )}

              <AnimatePresence>
                {notifs.map((n) => (
                  <motion.li
                    key={n.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className={`${styles.panelItem} ${
                      n.type === "friend" ? styles["panelItem--friend"] : ""
                    }`}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{n.msg}</span>
                      {n.type === "friend" && n.requesterId && (
                        <Button
                          size="small"
                          color="primary"
                          variant="contained"
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            padding: "2px 10px",
                          }}
                          onClick={() =>
                            handleAcceptFriend(n.requesterId!, n.id)
                          }
                        >
                          Aceptar
                        </Button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
