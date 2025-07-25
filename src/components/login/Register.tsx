import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Alert,
  MenuItem,
  Fade,
} from "@mui/material";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { motion } from "framer-motion";
import styles from "./Login.module.css";

interface RegisterProps {
  onRegisterSuccess: () => void;
  onCancel: () => void;
}

export default function Register({
  onRegisterSuccess,
  onCancel,
}: RegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    try {
      console.log(process.env.REACT_APP_API_URL);
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/users/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, language }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Registration failed");
      }

      setSuccess("Account created! You can now sign in.");
      setTimeout(() => {
        onRegisterSuccess();
      }, 1200);
    } catch (err: any) {
      setError(
        err?.message?.replace(/[^a-zA-Z0-9 .,!?]/g, "") || "Registration failed"
      );
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
          <Avatar className={styles.authAvatarRegister}>
            <PersonAddAlt1Icon />
          </Avatar>
          <Typography className={styles.authTitle}>Register</Typography>

          <form onSubmit={handleRegister}>
            <TextField
              label="Name"
              fullWidth
              required
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.authTextField}
            />
            <TextField
              label="E-mail"
              fullWidth
              required
              type="email"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              className={styles.authTextField}
            />
            <TextField
              label="Confirm Password"
              fullWidth
              required
              type="password"
              margin="normal"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={styles.authTextField}
            />
            <TextField
              label="Language"
              fullWidth
              select
              margin="normal"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={styles.authTextField}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Español</MenuItem>
            </TextField>

            {error && (
              <Fade in={!!error}>
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              </Fade>
            )}
            {success && (
              <Fade in={!!success}>
                <Alert severity="success" sx={{ mt: 2 }}>
                  {success}
                </Alert>
              </Fade>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              className={styles.authSubmit}
              sx={{
                backgroundColor: "#4caf50",
                ":hover": { backgroundColor: "#388e3c" },
              }}
            >
              Sign up
            </Button>
            <Button
              onClick={onCancel}
              fullWidth
              className={styles.authSecondaryButton}
            >
              ← Back to login
            </Button>
          </form>
        </Paper>
      </motion.div>
    </Box>
  );
}
