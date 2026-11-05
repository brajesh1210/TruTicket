# TruTicket System Architecture

## Overview
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Mobile App  │     │   Web App   │     │ Scanner App │
│ (Expo/RN)   │     │  (Next.js)  │     │ (Expo/Web)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌────────────▼────────────┐
              │      Supabase           │
              │  Auth + PostgreSQL +    │
              │  Edge Functions + RLS   │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
 ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
 │   Razorpay  │  │   n8n        │  │   ML Service │
 │ (Payments)  │  │ (Automation) │  │ (Risk Score) │
 └─────────────┘  └──────────────┘  └──────────────┘
        │
        │
 ┌──────▼──────┐
 │ Smart       │ Solidity + OpenZeppelin
 │ Contract    │ Polygon Amoy Testnet
 │ (TruTicket) │
 └─────────────┘
```

## Security Boundaries
1. **Frontend** — Presentation only. Zero security logic. No private keys.
2. **Edge Functions** — Validate auth, RBAC, policy, inventory, business transitions.
3. **PostgreSQL + RLS** — Row-level security. Users see only their own data.
4. **Smart Contract** — Authoritative for on-chain ticket ownership, resale ceiling.
5. **ML Service** — Advisory only. Cannot mint/transfer/redeem.
6. **Razorpay** — Authoritative for payment execution. Webhook verified server-side.

## State Machines
See Appendix A in PRD v2.0 for full state machine definitions.

## Three Pillars
1. **FairQueue** — Randomized allocation with seed commit-reveal audit.
2. **Ticket DNA + Dynamic QR** — 10-second rotating signed QR, atomic redemption.
3. **Price-Capped Resale** — Smart contract enforces ceiling on authorized transfers.