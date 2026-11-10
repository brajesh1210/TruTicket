# TruTicket — ML Brief (Fraud / Risk Scoring)

_For: ML contributor (model training). Status: brief v1, not started. Owner of backend contract: Brajesh._

## 1. What the model does

A **session risk scorer**. Given a user's recent behaviour and account signals, it returns a risk score (0–100) and a band (LOW / MEDIUM / HIGH) with the top reasons. It is a signal, not a judge: rules and phone verification still apply.

Target problem: bots and fraud rings in ticket sales (many accounts, fast queue joins, scalping, resale abuse, card testing).

## 2. Where the score is used in the app

| Moment | LOW | MEDIUM | HIGH |
|---|---|---|---|
| FairQueue join / admission | Normal | Joins queue at back | Held for review, no admission until cleared |
| Checkout | Normal | Extra OTP step-up | Checkout blocked, "verification required" message |
| Resale listing | Normal | Listing needs extra check | Listing held |
| Admin Risk Events / Session Investigation (web) | Shown in list | Shown with reasons | Shown first, reviewer actions |

Important: the model never permanently bans a user by itself. Every HIGH result is visible to the fraud reviewer in the admin panel. Real fans must not be blocked by a noisy score, so the false-positive rate is the main metric.

## 3. Output contract (fixed now, so the app can be built in parallel)

Request (`POST /score`):
```json
{
  "session_id": "string",
  "user_id": "uuid or null",
  "event_id": "uuid or null",
  "action": "queue_join | checkout | resale_list",
  "features": { "...": "see section 4" }
}
```

Response:
```json
{
  "session_id": "string",
  "risk_score": 0,
  "risk_band": "LOW | MEDIUM | HIGH",
  "reason_codes": ["VELOCITY_HIGH", "DEVICE_SHARED"],
  "model_version": "v0-rules"
}
```

Bands (initial): LOW < 30, MEDIUM 30–69, HIGH ≥ 70. Thresholds are tunable after evaluation.

Reason codes are short, fixed strings (the admin UI shows them as chips). Max 3 per response.

## 4. Features (no PII, no Aadhaar data, no images)

Allowed inputs are **behavioural and account-metadata signals only**:

- **Account:** account age (hours), email verified (bool), number of linked login methods (Google now; Apple, phone at Launch), number of verified emails, number of active devices, number of accounts seen on the same device fingerprint, number of accounts on the same IP in last 24h.
- **Behaviour:** queue joins in last hour, seconds from queue admission to checkout, ticket quantity requested, purchase attempts, payment failures, OTP requests and failures, failed login attempts.
- **Device / network:** device fingerprint reuse count, emulator or rooted flag, IP country is not IN, VPN/proxy flag (from provider when available).
- **Resale:** listing-to-sale ratio, attempts above price cap, number of transfers in last 7 days.

Not allowed: name, gender, religion, language, photo, Aadhaar number or any Aadhaar-derived value, and location finer than IP-level.

## 5. Labels

- Positive (fraud): fraud_events resolved as fraud by reviewer, chargebacks, bot-confirmed sessions.
- Negative (legit): completed purchases with no dispute after 30 days.
- Label delay is expected. Train on synthetic data first, then on real anonymised logs once the system is live.

## 6. Training plan (suggested)

1. **Synthetic dataset generator** (Python script): creates normal users plus bot / ring patterns (bursts of queue joins, many accounts per device, instant checkouts). Output: `data/synthetic.parquet` (not committed, generated locally).
2. **Baseline:** rule-based scorer (same contract, `model_version = v0-rules`). This ships first so the app works without a model.
3. **Model:** gradient-boosted trees (LightGBM or XGBoost). Calibrate probabilities (isotonic or Platt) so 70 means roughly 70%.
4. **Explainability:** top 3 features by SHAP value mapped to reason codes.
5. **Serve:** FastAPI in `services/ml/` with `POST /score`. Model file versioned as `models/risk_v1.joblib`. Docker image in `infra/Dockerfile.ml`.

## 7. Metrics (must report all)

- PR-AUC and recall at 1% false-positive rate.
- **False-positive rate on legitimate users** (primary constraint: keep this very low).
- Score distribution by band (sanity check).
- Latency p95 under 100 ms for `/score`.
- Model card: data source, features, limits, known failure cases.

## 8. Safety rules

- Service down or timeout: the Edge Function falls back to the rules scorer. It must never default to LOW for everyone (fail-closed for HIGH-risk actions, not fail-open).
- No automatic bans. HIGH results go to the admin Risk Events queue.
- Model artifacts are not committed to git if larger than 10 MB; share via the team drive and record the checksum in `docs/ML_MODEL_CARD.md`.
- No real user data in the repo. Use synthetic data for development.

## 9. Deliverables from the ML contributor

- [ ] Synthetic data generator script
- [ ] Rules baseline (v0) matching the contract in section 3
- [ ] Trained model v1 with metrics report
- [ ] Feature list with descriptions
- [ ] Model card (`docs/ML_MODEL_CARD.md`)
- [ ] FastAPI service passing a contract test with sample requests

## 10. Can it start now?

Yes. Steps 1–2 need no database and no app. Start with the synthetic generator and the rules baseline, using the contract in section 3. Real data joins later, after Phase 2 of the plan.
