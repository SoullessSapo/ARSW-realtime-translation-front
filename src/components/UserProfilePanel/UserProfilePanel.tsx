import React from "react";
import styles from "./UserProfilePanel.module.css";
import { motion } from "framer-motion";
import LogoutIcon from "@mui/icons-material/Logout";

export default function UserProfilePanel({
  user,
  onLogout,
}: {
  user: any;
  onLogout?: () => void;
}) {
  return (
    <motion.div
      className={styles.profileRoot}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.profileAvatar}>
        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
      </div>
      <div className={styles.profileName}>{user?.name || user?.email}</div>
      <div className={styles.profileEmail}>{user?.email}</div>
      <button className={styles.profileBtn} onClick={onLogout}>
        <LogoutIcon fontSize="small" />
        Logout
      </button>
    </motion.div>
  );
}
