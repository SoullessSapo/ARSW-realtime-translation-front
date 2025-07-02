import React from "react";
import { PuffLoader } from "react-spinners";

export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center">
      <PuffLoader color="#6366f1" size={80} speedMultiplier={1.2} />
    </div>
  );
}
