import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import styles from "./NotificationPanel.module.css";
import { Tooltip, IconButton } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { motion, AnimatePresence } from "framer-motion";

const SOCKET_URL = process.env.REACT_APP_API_URL;

type Notification = { msg: string; id: number; type?: string };

export default function NotificationPanel({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL!, { query: { userId } });

    let i = 0;
    const push = (msg: string, type?: string) =>
      setNotifs((n) => [{ msg, id: ++i, type }, ...n]);

    socket.on("user-joined", (data) => push(`${data.userName} joined!`));
    socket.on("user-left", (data) => push(`${data.userName} left.`));
    socket.on("friend-request", (data) =>
      push(`${data.requesterName} sent you a friend request!`, "friend")
    );
    socket.on("meeting-invitation", (data) =>
      push(`${data.invitedByName} invited you to ${data.meetingTitle}`)
    );

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  return (
    <motion.div
      className={styles.panelRoot}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
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
              {n.msg}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}
