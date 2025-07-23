import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Button,
  Box,
  CssBaseline,
  useMediaQuery,
  Menu,
  MenuItem,
  Badge,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { motion } from "framer-motion";
import { io } from "socket.io-client";

import Login from "./components/login/Login";
import Register from "./components/login/Register";
import Dashboard from "./Dashboard/Dashboard";
// import VideoCall from "./components/VideoCall/VideoCall";  // ← ya no
import CallRoom from "./pages/CallRoom"; // ajusta la ruta según dónde pusiste CallRoom.tsx
import Sidebar from "./components/Sidebar/Sidebar";
import Loader from "./components/Loader/Loader";
import UserProfilePanel from "./components/UserProfilePanel/UserProfilePanel";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

export default function App() {
  type Notification = {
    id: number;
    msg: string;
    type?: "friend" | "meeting" | "join" | "leave" | "public";
  };

  const [user, setUser] = useState<any>(() =>
    JSON.parse(localStorage.getItem("user") || "null")
  );
  const [token, setToken] = useState<string>(
    localStorage.getItem("token") || ""
  );
  const [meeting, setMeeting] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [currentSection, setCurrentSection] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const isMobile = useMediaQuery("(max-width:600px)");

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL, {
      query: { userId: user.id },
    });

    let id = 0;
    const push = (msg: string, type?: Notification["type"]) =>
      setNotifs((prev) => [{ id: ++id, msg, type }, ...prev]);

    socket.on("user-joined", (data) => push(`${data.userName} joined`, "join"));
    socket.on("user-left", (data) => push(`${data.userName} left`, "leave"));
    socket.on("friend-request", (data) =>
      push(`${data.requesterName} sent you a friend request!`, "friend")
    );
    socket.on("meeting-invitation", (data) =>
      push(
        `${data.invitedByName} invited you to ${data.meetingTitle}`,
        "meeting"
      )
    );
    socket.on("public-meeting-created", (data) =>
      push(`New public meeting: ${data.meeting.title}`, "public")
    );

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleLogin = (u: any, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("token", t);
    setRefreshKey((k) => k + 1);
  };

  const handleLogout = () => {
    setUser(null);
    setToken("");
    setMeeting(null);
    setShowProfile(false);
    setCurrentSection("dashboard");
    localStorage.clear();
  };

  if (!user) {
    return showRegister ? (
      <Register
        onRegisterSuccess={() => setShowRegister(false)}
        onCancel={() => setShowRegister(false)}
      />
    ) : (
      <Login
        onLogin={handleLogin}
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <>
      <CssBaseline />
      {loading && <Loader />}
      {user && showProfile && (
        <UserProfilePanel user={user} onLogout={handleLogout} />
      )}

      <Box sx={{ display: "flex" }}>
        {!isMobile && user && (
          <Sidebar
            user={user}
            current={currentSection}
            onNavigate={setCurrentSection}
          />
        )}

        <AppBar position="fixed" sx={{ zIndex: 1300, background: "#1e1e2f" }}>
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box display="flex" alignItems="center" gap={2}>
              {isMobile && (
                <IconButton edge="start" color="inherit" aria-label="menu">
                  <MenuIcon />
                </IconButton>
              )}
              <Avatar sx={{ bgcolor: "#9c3cff" }}>RT</Avatar>
              <Typography
                variant="h6"
                component="div"
                sx={{ fontWeight: "bold", color: "#9c3cff" }}
              >
                RealTime Meetings
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={2}>
              <IconButton onClick={handleOpen} color="inherit">
                <Badge badgeContent={notifs.length} color="secondary">
                  <NotificationsIcon />
                </Badge>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                  style: {
                    background: "#1c1c2e",
                    color: "#f3f4f6",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    minWidth: 260,
                  },
                }}
              >
                <MenuItem disableRipple>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    width="100%"
                  >
                    <Typography fontWeight="bold">Notifications</Typography>
                    {notifs.length > 0 && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setNotifs([]);
                          handleClose();
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </Box>
                </MenuItem>

                {notifs.length === 0 ? (
                  <MenuItem disabled>
                    <Typography variant="body2" color="#aaa">
                      No notifications
                    </Typography>
                  </MenuItem>
                ) : (
                  notifs.map((n) => (
                    <MenuItem key={n.id} disableRipple>
                      <Box display="flex" alignItems="center" gap={1}>
                        {n.type === "friend" && <span>👥</span>}
                        {n.type === "meeting" && <span>📅</span>}
                        {n.type === "join" && <span>✅</span>}
                        {n.type === "leave" && <span>🚪</span>}
                        {n.type === "public" && <span>📢</span>}
                        <Typography variant="body2">{n.msg}</Typography>
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Menu>

              <Button
                variant="contained"
                color="primary"
                onClick={() => setShowProfile((s) => !s)}
              >
                {user.name?.[0]?.toUpperCase() ||
                  user.email?.[0]?.toUpperCase()}
              </Button>
              <IconButton color="error" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        <Box
          component={motion.main}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          sx={{
            flexGrow: 1,
            p: 3,
            mt: "64px",
            backgroundColor: "#14141f",
            minHeight: "100vh",
            color: "#f5f5f7",
          }}
        >
          {/* Vista dashboard */}
          {!meeting && currentSection === "dashboard" && (
            <Dashboard user={user} token={token} onJoinMeeting={setMeeting} />
          )}

          {/* Otras secciones placeholder */}
          {!meeting && ["friends", "meetings"].includes(currentSection) && (
            <Typography
              variant="h5"
              align="center"
              sx={{ mt: 10, color: "#888" }}
            >
              {currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}{" "}
              coming soon! 🎉
            </Typography>
          )}

          {/* Vista llamada */}
          {meeting && (
            <Box>
              <Button
                color="secondary"
                onClick={() => setMeeting(null)}
                sx={{ mb: 2 }}
              >
                ← Back to Dashboard
              </Button>

              <CallRoom meetingId={meeting?.id} myId={user?.id} />
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}
