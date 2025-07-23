import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Alert,
  Fade,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { motion } from "framer-motion";
import styles from "./Login.module.css";

interface LoginProps {
  onLogin: (user: any, accessToken: string) => void;
  onShowRegister: () => void;
}

export default function Login({ onLogin, onShowRegister }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      sessionStorage.setItem("token", data.access_token);
      onLogin(data.user, data.access_token);
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <Box className={styles.authBg}>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Paper elevation={12} className={styles.authCard}>
          <Avatar className={styles.authAvatar}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography className={styles.authTitle}>Sign in</Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="E-mail"
              fullWidth
              required
              type="email"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className={styles.authTextField}
            />
            <TextField
              label="Password"
              fullWidth
              required
              type="password"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={styles.authTextField}
            />

            {error && (
              <Fade in={!!error}>
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              </Fade>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              className={styles.authSubmit}
              sx={{
                backgroundColor: "#4053fc",
                ":hover": { backgroundColor: "#3244d5" },
              }}
            >
              Sign in
            </Button>

            <Button
              onClick={onShowRegister}
              fullWidth
              className={styles.authSecondaryButton}
            >
              Register new account
            </Button>
          </form>
        </Paper>
      </motion.div>
    </Box>
  );
}
