import React from "react";

/** Official TruTicket mark from the supplied logo (assets/brand). Used everywhere the app logo appears. */
export function Logo({ height = 28, word = true }: { height?: number; word?: boolean }) {
  return (
    <div className="logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="TruTicket logo" style={{ height, width: "auto" }} />
      {word ? <span className="logo-word">TruTicket</span> : null}
    </div>
  );
}
