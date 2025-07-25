import React, { useEffect, useState } from "react";
import axios from "axios";

const Health: React.FC = () => {
  const [status, setStatus] = useState<string>("Checking...");

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/health`)
      .then(() => setStatus("OK"))
      .catch(() => setStatus("ERROR"));
  }, []);

  return (
    <div>
      <h2>Health Check</h2>
      <p>Status: {status}</p>
    </div>
  );
};

export default Health;
