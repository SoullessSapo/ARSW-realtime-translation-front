import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <>
      <App />
      <ToastContainer
        position="top-center"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        toastStyle={{
          borderRadius: "1rem",
          background: "linear-gradient(145deg, #10172a, #0e1423)",
          color: "#f1f5f9",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          boxShadow: "0 8px 32px rgba(59,130,246,0.15)",
        }}
      />
    </>
  </React.StrictMode>
);

// Si tienes reportWebVitals.ts, descomenta la siguiente línea:
// reportWebVitals();
