"use client";

import { useState } from "react";
import { Badge, Card } from "./ui";
import { inr } from "@/lib/format";

const STEPS = ["Event information", "Venue & schedule", "Ticket types", "Resale policy", "Review & publish"];

type Form = {
  title: string;
  category: string;
  description: string;
  organiser: string;
  website: string;
  venue: string;
  city: string;
  start: string;
  end: string;
  doors: string;
  saleStart: string;
  saleEnd: string;
  resaleCap: number; // max resale as % of face value. 110 = 11,000 bps (PRD 6.5).
  transferLimit: number;
  resaleCutoff: string;
  platformFee: number; // PRD range 1–3%
};

type NewTier = { name: string; face: number; qty: number; limit: number; groupAllowed: boolean };

const EMPTY: Form = {
  title: "",
  category: "Concerts",
  description: "",
  organiser: "TruTicket Events",
  website: "https://www.truticket.in",
  venue: "",
  city: "Navi Mumbai",
  start: "",
  end: "",
  doors: "16:00",
  saleStart: "",
  saleEnd: "",
  resaleCap: 110,
  transferLimit: 2,
  resaleCutoff: "",
  platformFee: 2,
};

/** Create event wizard (PRD screen 16). Five steps, validated before Continue. */
export function CreateEventWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ ...EMPTY, title: "Sunset Music Festival 2025", venue: "DY Patil Stadium" });
  const [tiers, setTiers] = useState<NewTier[]>([
    { name: "General Admission", face: 2499, qty: 10000, limit: 6, groupAllowed: false },
  ]);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const set =
    <K extends keyof Form>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value });

  const setNum = (key: "resaleCap" | "transferLimit" | "platformFee") => (v: number) =>
    setForm({ ...form, [key]: v });

  function updateTier(i: number, patch: Partial<NewTier>) {
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers([...tiers, { name: "New ticket type", face: 999, qty: 500, limit: 4, groupAllowed: false }]);
  }

  // Basic checks per step. Full validation (zod) comes with the Phase 2 API.
  function stepError(): string | null {
    if (step === 0 && (!form.title.trim() || !form.category)) return "Add an event title and a category.";
    if (step === 1 && (!form.venue.trim() || !form.start)) return "Add the venue and the start date.";
    if (step === 2) {
      if (tiers.length === 0) return "Add at least one ticket type.";
      const bad = tiers.find((t) => t.face <= 0 || t.qty <= 0 || t.limit <= 0);
      if (bad) return `Check "${bad.name}": face value, quantity, and limit must be above zero.`;
    }
    if (step === 3) {
      if (form.resaleCap < 100 || form.resaleCap > 150) return "Resale cap must be between 100% and 150%.";
      if (form.platformFee < 1 || form.platformFee > 3) return "Platform resale fee must be between 1% and 3%.";
    }
    return null;
  }

  function next() {
    const err = stepError();
    if (err) {
      setMessage({ text: err, tone: "err" });
      return;
    }
    setMessage(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function publish() {
    setMessage({
      text: "Submitted for review (demo). Real publishing, the on-chain policy, and admin approval come in Phase 2.",
      tone: "ok",
    });
  }

  return (
    <div className="stack">
      <div className="stepper" aria-label="Wizard steps">
        {STEPS.map((label, i) => (
          <div key={label} className="row" style={{ flex: i === STEPS.length - 1 ? "0 0 auto" : 1 }}>
            <div className={`step ${i === step ? "current" : i < step ? "done" : ""}`}>
              <span className="step-num">{i < step ? "✓" : i + 1}</span>
              <span className="hide-sm">{label}</span>
            </div>
            {i < STEPS.length - 1 ? <div className="step-line" /> : null}
          </div>
        ))}
      </div>

      {message ? <div className={`notice ${message.tone === "err" ? "err" : ""}`}>{message.text}</div> : null}

      {step === 0 ? (
        <Card title="Event information">
          <p className="muted small">Tell attendees what the event is about.</p>
          <div className="grid-form">
            <Field label="Event title *">
              <input className="input" value={form.title} onChange={set("title")} />
            </Field>
            <Field label="Category *">
              <select className="input" value={form.category} onChange={set("category")}>
                <option>Concerts</option>
                <option>Sports</option>
                <option>Comedy</option>
                <option>Festivals</option>
                <option>Conferences</option>
              </select>
            </Field>
            <Field label={`Description (${form.description.length}/500)`} full>
              <textarea className="input" maxLength={500} value={form.description} onChange={set("description")} />
            </Field>
            <Field label="Organiser name">
              <input className="input" value={form.organiser} onChange={set("organiser")} />
            </Field>
            <Field label="Organiser website">
              <input className="input" value={form.website} onChange={set("website")} />
            </Field>
            <Field label="Cover image" full>
              <div className="placeholder">Upload JPG, PNG, or WebP up to 5 MB. Upload comes with Phase 2 storage.</div>
            </Field>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="Venue & schedule">
          <div className="grid-form">
            <Field label="Venue *">
              <input className="input" value={form.venue} onChange={set("venue")} />
            </Field>
            <Field label="City">
              <input className="input" value={form.city} onChange={set("city")} />
            </Field>
            <Field label="Start date and time *">
              <input className="input" type="datetime-local" value={form.start} onChange={set("start")} />
            </Field>
            <Field label="End date and time">
              <input className="input" type="datetime-local" value={form.end} onChange={set("end")} />
            </Field>
            <Field label="Doors open">
              <input className="input" type="time" value={form.doors} onChange={set("doors")} />
            </Field>
            <Field label="Sale starts">
              <input className="input" type="datetime-local" value={form.saleStart} onChange={set("saleStart")} />
            </Field>
            <Field label="Sale ends">
              <input className="input" type="datetime-local" value={form.saleEnd} onChange={set("saleEnd")} />
            </Field>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="Ticket types" action={<button className="btn btn-sm" onClick={addTier}>+ Add ticket type</button>}>
          <div className="stack">
            {tiers.map((t, i) => (
              <div key={i} className="card" style={{ background: "var(--bg-raised)" }}>
                <div className="grid-form">
                  <Field label="Name">
                    <input className="input" value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
                  </Field>
                  <Field label="Face value (₹)" hint="Stored in paise in the database. Never changes.">
                    <input className="input" type="number" min={1} value={t.face} onChange={(e) => updateTier(i, { face: Number(e.target.value) })} />
                  </Field>
                  <Field label="Quantity">
                    <input className="input" type="number" min={1} value={t.qty} onChange={(e) => updateTier(i, { qty: Number(e.target.value) })} />
                  </Field>
                  <Field label="Max per account">
                    <input className="input" type="number" min={1} value={t.limit} onChange={(e) => updateTier(i, { limit: Number(e.target.value) })} />
                  </Field>
                </div>
                <label className="row small" style={{ marginTop: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={t.groupAllowed} onChange={(e) => updateTier(i, { groupAllowed: e.target.checked })} />
                  Allow group / corporate bulk orders (FR-027). Group orders can be larger than the per-account limit.
                </label>
                <div className="small muted" style={{ marginTop: 8 }}>
                  Revenue at full sell-out: {inr(t.face * t.qty)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card title="Resale policy">
          <div className="grid-form">
            <Field label={`Max resale as % of face value: ${form.resaleCap}%`} hint="100% = no profit. 110% = up to 10% above face value (PRD example).">
              <input className="range" type="range" min={100} max={150} value={form.resaleCap} onChange={(e) => setNum("resaleCap")(Number(e.target.value))} />
            </Field>
            <Field label="Transfers per ticket">
              <select className="input" value={form.transferLimit} onChange={(e) => setNum("transferLimit")(Number(e.target.value))}>
                <option value={1}>1 transfer</option>
                <option value={2}>2 transfers</option>
                <option value={3}>3 transfers</option>
              </select>
            </Field>
            <Field label="Resale cutoff">
              <input className="input" type="datetime-local" value={form.resaleCutoff} onChange={set("resaleCutoff")} />
            </Field>
            <Field label="Platform resale fee (%)" hint="PRD range: 1–3%.">
              <input className="input" type="number" step={0.5} min={1} max={3} value={form.platformFee} onChange={(e) => setNum("platformFee")(Number(e.target.value))} />
            </Field>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card title="Review & publish">
          <div className="kv"><span>Title</span><span>{form.title || "—"}</span></div>
          <div className="kv"><span>Category</span><span>{form.category}</span></div>
          <div className="kv"><span>Venue</span><span>{form.venue || "—"}, {form.city}</span></div>
          <div className="kv"><span>Starts</span><span>{form.start || "—"}</span></div>
          <div className="kv"><span>Ticket types</span><span>{tiers.length}</span></div>
          <div className="kv"><span>Total inventory</span><span>{tiers.reduce((s, t) => s + t.qty, 0).toLocaleString("en-IN")}</span></div>
          <div className="kv"><span>Resale cap</span><span>{form.resaleCap}% of face value</span></div>
          <div className="kv"><span>Platform resale fee</span><span>{form.platformFee}%</span></div>
          <div className="row" style={{ marginTop: 8 }}>
            <Badge tone="warning">Draft until approved</Badge>
          </div>
        </Card>
      ) : null}

      <div className="spread">
        <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ← Back
        </button>
        <div className="row">
          <button className="btn" onClick={() => setMessage({ text: "Draft saved (demo). Drafts sync to the server in Phase 2.", tone: "ok" })}>
            Save draft
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={next}>
              Continue →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={publish}>
              Submit for review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field" style={full ? { gridColumn: "1 / -1" } : undefined}>
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
