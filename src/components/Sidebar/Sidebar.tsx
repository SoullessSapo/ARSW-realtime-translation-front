import React, { useState } from "react";
import styles from "./Sidebar.module.css";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupIcon from "@mui/icons-material/Group";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { Tooltip } from "@mui/material";
import { motion } from "framer-motion";

export default function Sidebar({
  user,
  current,
  onNavigate,
}: {
  user: any;
  current?: string;
  onNavigate?: (section: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <motion.aside
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: open ? 0 : -90, opacity: open ? 1 : 0.5 }}
        transition={{ duration: 0.4 }}
        className={styles.sidebarRoot}
        style={{ left: open ? 0 : -90, pointerEvents: open ? "auto" : "none" }}
      >
        <button
          className={styles.sidebarToggleBtn}
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            top: 18,
            right: -18,
            zIndex: 1100,
            background: "#15182c",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            cursor: "pointer",
            color: "#fff",
            boxShadow: "0 2px 8px #0003",
          }}
          aria-label="Ocultar menú"
        >
          <span
            style={{
              display: "block",
              transform: "rotate(180deg)",
              fontSize: 18,
            }}
          >
            ➤
          </span>
        </button>
        <div className={styles.sidebarAvatar}>
          {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
        </div>

        <nav className={styles.sidebarNav}>
          <Tooltip title="Dashboard" placement="right">
            <button
              type="button"
              className={`${styles.sidebarNavLink} ${
                current === "dashboard" ? styles.active : ""
              }`}
              onClick={() => onNavigate?.("dashboard")}
            >
              <DashboardIcon fontSize="inherit" />
            </button>
          </Tooltip>

          <Tooltip title="Friends" placement="right">
            <button
              type="button"
              className={`${styles.sidebarNavLink} ${
                current === "friends" ? styles.active : ""
              }`}
              onClick={() => onNavigate?.("friends")}
            >
              <GroupIcon fontSize="inherit" />
            </button>
          </Tooltip>

          <Tooltip title="Meetings" placement="right">
            <button
              type="button"
              className={`${styles.sidebarNavLink} ${
                current === "meetings" ? styles.active : ""
              }`}
              onClick={() => onNavigate?.("meetings")}
            >
              <VideoCallIcon fontSize="inherit" />
            </button>
          </Tooltip>
        </nav>
      </motion.aside>
      {!open && (
        <button
          className={styles.sidebarShowBtn}
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            top: 90,
            left: 0,
            zIndex: 1200,
            background: "#15182c",
            border: "none",
            borderRadius: "0 50% 50% 0",
            width: 32,
            height: 56,
            cursor: "pointer",
            color: "#fff",
            boxShadow: "2px 2px 8px #0003",
          }}
          aria-label="Mostrar menú"
        >
          <span style={{ display: "block", fontSize: 22 }}>➤</span>
        </button>
      )}
    </>
  );
}
