"use client";

import { useState } from "react";
import { Card } from "./ui";

/** Authorise a gate scanner device for a staff member (PRD screen 21). Mock until Phase 2. */
export function AuthorizeDevice({ staff }: { staff: string[] }) {
  const [who, setWho] = useState("");
  const [device, setDevice] = useState("");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  function authorise() {
    if (!who) {
      setNote({ text: "Pick a staff member first.", tone: "err" });
      return;
    }
    if (device.trim().length < 6) {
      setNote({ text: "Enter the device ID (at least 6 characters).", tone: "err" });
      return;
    }
    setNote({ text: `Device ${device.trim()} authorised for ${who} (demo). Phase 2 stores the device key.`, tone: "ok" });
    setDevice("");
  }

  return (
    <Card title="Authorise a device">
      <p className="small muted">A scanner device works only after you authorise it for one staff member and one event.</p>
      <div className="field">
        <label htmlFor="staff">Staff member</label>
        <select id="staff" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Select staff member</option>
          {staff.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="device">Device ID / IMEI</label>
        <input id="device" className="input" placeholder="Enter device ID" value={device} onChange={(e) => setDevice(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={authorise}>
        Authorise device
      </button>
      {note ? <div className={`notice ${note.tone === "err" ? "err" : ""}`}>{note.text}</div> : null}
    </Card>
  );
}
