import React from "react";
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
  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={styles.sidebarRoot}
    >
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
  );
}
