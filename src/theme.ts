import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "linear-gradient(160deg, #0f1121, #12152b)",
      paper: "linear-gradient(145deg, #10172a, #0e1423)",
    },
    text: {
      primary: "#f1f5f9",
      secondary: "#a1a8bb",
      disabled: "#6b7280",
    },
    primary: {
      main: "#3b82f6",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#9333ea",
      contrastText: "#ffffff",
    },
    error: {
      main: "#ef4444",
    },
    warning: {
      main: "#facc15",
    },
    info: {
      main: "#0ea5e9",
    },
    success: {
      main: "#22c55e",
    },
    divider: "rgba(255,255,255,0.1)",
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: "linear-gradient(160deg, #0f1121, #12152b)",
          fontFamily: "Inter, sans-serif",
          color: "#f1f5f9",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: "linear-gradient(145deg, #10172a, #0e1423)",
          borderRadius: 24,
          boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
          transition: "all 0.3s ease",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          background: "#1c1f33",
          borderRadius: 10,
          color: "#f1f5f9",
          transition: "border-color 0.3s, box-shadow 0.3s",
        },
        input: {
          color: "#f1f5f9",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#4b5563",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#3b82f6",
            boxShadow: "0 0 0 3px rgba(59,130,246,0.3)",
          },
        },
        notchedOutline: {
          borderColor: "#3f475c",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#a1a8bb",
          "&.Mui-focused": {
            color: "#3b82f6",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
          },
          "&:disabled": {
            opacity: 0.5,
            cursor: "not-allowed",
          },
        },
        containedPrimary: {
          background: "linear-gradient(to right, #22c55e, #15803d)",
          color: "#f0fdf4",
          boxShadow: "0 6px 18px rgba(34,197,94,0.4)",
          "&:hover": {
            background: "linear-gradient(to right, #166534, #14532d)",
            boxShadow: "0 8px 24px rgba(34,197,94,0.5)",
            transform: "translateY(-2px)",
          },
        },
        outlined: {
          borderColor: "#3b82f6",
          color: "#3b82f6",
          "&:hover": {
            borderColor: "#60a5fa",
            backgroundColor: "rgba(59,130,246,0.1)",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1e293b",
          color: "#f8fafc",
          fontSize: 14,
          border: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          background: "#1e293b",
          color: "#f1f5f9",
          "&.MuiChip-clickable:hover": {
            background: "#334155",
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(135deg, #3b82f6, #9333ea)",
          color: "#fff",
          fontWeight: 700,
        },
      },
    },
  },
});

export default darkTheme;
