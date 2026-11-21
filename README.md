# TruTicket 🎟️


<div align="center">

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_57-4630EB?style=for-the-badge&logo=expo)](https://expo.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.3-F7931E?style=for-the-badge&logo=scikit-learn)](https://scikit-learn.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![Polygon Amoy](https://img.shields.io/badge/Polygon-Amoy_Testnet-8247E5?style=for-the-badge&logo=polygon)](https://polygon.technology/)
[![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**Fair access. Genuine tickets. Controlled resale.**

*A production-grade, end-to-end event ticketing infrastructure engineered to eliminate scalper bots, counterfeiting, and secondary-market extortion.*

</div>

---

## 👥 Engineering Team

| Member | Role | Core Responsibility |
| :--- | :--- | :--- |
| **Anany** | ML Engine, Fraud Defense & Security Lead | Hybrid Scorer, Kinematic Rules, Risk Telemetry, On-Chain Scalper Prevention, Bot Contract Exploit Defense & Behavioral Gating |
| **Ansh** | Mobile Frontend & Scanner Lead | React Native (Expo SDK 57), Dynamic QR, Gate Scanner, Client Ticket Cryptographic Verification & On-Chain Turnstile Redemption |
| **Brajesh** | Backend Architecture & Blockchain Lead | Edge Functions, PostgreSQL RLS, System Architecture, `TruTicket.sol` (ERC-721), Polygon Amoy Deployment, Resale Escrow & Hardhat Test Suite |
| **Shivam** | Web Frontend & Portal Lead | Next.js 15, Organiser & Admin Portals, Landing UI, Resale Cap Policy Controls, Web3 Transactions & Emergency Pause Multi-Sig UI |

---
## 📑 index
---

| # | Section / Subsystem | Primary Tech Stack | Blockchain | Description |
| :-: | :--- | :--- | :--- | :--- |
| **01** | [The Three Pillars](#-the-three-pillars-of-truticket) | Full Stack | Polygon Amoy L2 / ERC-721 | Core anti-scalping, dynamic QR, and on-chain price caps |
| **02** | [System Architecture](#-system-architecture) | Next.js, Expo, Supabase | Smart Contract Security Boundary | Multi-tier security boundary model and cross-system data flow |
| **03** | [Blockchain & Smart Contracts](#-blockchain--smart-contracts) | Solidity 0.8.20, Hardhat | `TruTicket.sol` (OpenZeppelin) | Protocol-level price ceilings, non-custodial transfers, turnstile redemption |
| **04** | [ML Risk & Fraud Engine](#-ml-risk--fraud-detection-service) | FastAPI, scikit-learn | Anti-Bot Contract Protection | Calibrated 3-Class Random Forest + kinematic physical rules |
| **05** | [Tech Stack Matrix](#-tech-stack) | Monorepo Workspace | Chain ID 80002 (Polygon Amoy) | Complete framework, database, and blockchain versions |
| **06** | [Quick Start & Setup](#-quick-start) | Node.js, Python, Hardhat | `npm run contracts:compile` | Step-by-step setup, unified runner (`npm run dev`), env config |
| **07** | [Live Services & Dashboards](#-live-service-urls) | Web, Mobile, FastAPI | On-Chain Event Explorers | Admin Risk Queue, Organiser Fraud Dashboard, Swagger Docs |
| **08** | [Repository Structure](#-repository-structure) | Monorepo Tree | `contracts/` Hardhat workspace | Comprehensive file tree across all applications and services |
| **09** | [API & Smart Contract Contracts](#-api--contracts) | REST, JSON, Solidity ABI | Solidity Interfaces & Methods | `mint`, `listForResale`, `settleResale`, `redeem`, `/score` |
| **10** | [Verification & Testing](#-verification--testing) | PyUnit, Hardhat Chai | 34 Passing Smart Contract Tests | 100% passing test matrix for ML, Contracts, and Next.js build |

---

## 🌟 The Three Pillars of TruTicket

TruTicket solves the primary failure modes of modern event ticketing (bot scalping, fake PDF/screenshot resales, and predatory secondary market markups) through three foundational pillars:

1. **FairQueue & Behavioral Anti-Bot Gating**
   - Cryptographically verifiable randomized waiting room with commit-reveal seed audits.
   - Live browser kinematic analysis (mouse dynamics, inter-request velocity, and HTTP headers) processed by a calibrated 3-class Machine Learning model.
2. **Ticket DNA + Dynamic Rotating QR**
   - Offline-capable, HMAC-SHA256 signed, 10-second rotating TOTP QR codes rendered directly on the device secure enclave.
   - Screen-recording and screenshot proof. Single-use atomic redemption prevents replay attacks at physical turnstiles.
3. **Smart Contract-Enforced Resale Price Caps**
   - Non-custodial and custodial ERC-721 ticket NFTs deployed on Polygon Amoy.
   - Protocol-level resale price ceilings (max 100%–200% face value) enforced directly inside the Solidity bytecode; secondary transactions above price caps revert automatically on-chain.

-----

## 🏗️ System Architecture

``````
                       ┌────────────────────────────────────────────────────────┐
                       │                     CLIENT APPS                        │
                       └───────────────────┬────────────────────────────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
   ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
   │    Mobile App     │         │   Web Dashboard   │         │    Gate Scanner   │
   │ React Native Expo │         │    Next.js 15     │         │ Expo Camera / NFC │
   │ (Attendee Wallet) │         │ (Admin/Organiser) │         │ (Turnstile App)   │
   └─────────┬─────────┘         └─────────┬─────────┘         └─────────┬─────────┘
             │                             │                             │
             └─────────────────────────────┼─────────────────────────────┘
                                           ▼
                       ┌───────────────────────────────────────┐
                       │        SUPABASE CLUSTER / EDGE        │
                       │ · PostgreSQL with Row-Level Security  │
                       │ · Deno TypeScript Edge Functions      │
                       │ · Session & Device Attestation        │
                       └───────┬───────────────┬───────┬───────┘
                               │               │       │
             ┌─────────────────┘               │       └─────────────────┐
             ▼                                 ▼                         ▼
   ┌───────────────────┐             ┌───────────────────┐     ┌───────────────────┐
   │ ML Risk Service   │             │ Razorpay Gateway  │     │ n8n Automation    │
   │ FastAPI (:8000)   │             │ · Test Mode India │     │ · Webhook alerts  │
   │ · RF 3-Class      │             │ · Webhook verify  │     │ · Email dispatch  │
   │ · Kinematic Rules │             │ · Atomic Escrow   │     │ · Fraud escalations│
   └───────────────────┘             └───────────────────┘     └───────────────────┘
                                               │
                                               ▼
                                     ┌───────────────────┐
                                     │  Polygon Amoy L2  │
                                     │ TruTicket ERC-721 │
                                     │ · Resale cap rule │
                                     │ · Atomic transfer │
                                     └───────────────────┘
```

### Security Boundary Model

| Tier | Boundary Enforcement | Responsibilities |
| :--- | :--- | :--- |
| **Presentation Tier** | Zero Private Keys / Read Only Tokens | UI rendering, client-side dynamic QR animation, gesture telemetry collection. |
| **Edge Compute Tier** | Deno Edge Functions + JWT + HMAC | RBAC verification, transaction orchestration, payment verification, session validation. |
| **Data Tier** | PostgreSQL + Row-Level Security (RLS) | Strict isolation; users only query tickets and orders bound to their cryptographic identity. |
| **ML Intelligence** | Advisory Only Service | Computes continuous risk scores (0–100) and reason codes. Never acts as execution judge; sends ambiguous traffic to step-up verification. |
| **On-Chain Settlement** | Solidity Smart Contracts | Decentralized source of ownership truth; immutable price ceilings and transfer counts. |

---

## 🧠 ML Risk & Fraud Detection Service

Located in [`services/ml/`](file:///c:/Users/Anany%20Pratyush/Documents/Desktop%20files/Projects/TruTicket/services/ml), the service protects inventory drops from automated scalper rings using a **Hybrid Architecture** combining probabilistic machine learning with deterministic physical kinematic validation.

```
                      [ User Session Telemetry ]
                      │  - Mouse trajectory (dist, std, heading changes, speed)
                      │  - Web log patterns (request velocity, gap std, static ratio)
                      ▼
         ┌───────────────────────────┴───────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     3-Class Random Forest       │             │   Kinematic Safety Rules Engine │
│ Pipeline (scikit-learn)         │             │   (Deterministic Physical Laws) │
│ · P(human)                      │             │ · Straightness threshold checks │
│ · P(moderate_bot)               │             │ · Speed uniformity anomalies    │
│ · P(advanced_bot)               │             │ · Direction change reversal rate│
└────────────────┬────────────────┘             └────────────────┬────────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │     Hybrid Risk Calibrator    │
                         │   Continuous Score: 0 – 100   │
                         └───────────────┬───────────────┘
                                         ▼
            ┌───────────────────┬───────────────────┬───────────────────┐
            ▼                   ▼                   ▼                   ▼
         **LOW**             **MEDIUM**           **HIGH**          **CRITICAL**
        (0 – 30)            (31 – 59)           (60 – 79)           (80 – 100)
    Frictionless Path     Step-Up CAPTCHA /     Delayed Queue &      Flag for Audit /
     Immediate Hold           SMS OTP          Hold Restriction      Inventory Freeze
```

### Endpoints

- `GET /health`: Health status, model readiness, version (`1.0.0-rf-hybrid`), and class mapping.
- `POST /score`: Full hybrid scoring with detailed mouse dynamics and request telemetry.
- `POST /predict`: Unified compatibility endpoint supporting nested and flat session telemetry.
- `GET /sample-sessions`: Curated human, scraper bot, and advanced evasion bot telemetry profiles.
- `POST /simulate`: Real-time scenario evaluator for admin and reviewer simulation.

---

## 💻 Tech Stack

| Layer | Framework / Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Mobile App** | React Native, Expo Router, NativeWind | Expo SDK 57 / RN 0.76 | Attendee wallet, offline dynamic QR, gate scanner |
| **Web App** | Next.js, React 19, TypeScript, Tailwind | Next.js 15.5 | Organiser portal, admin risk triage, public catalog |
| **Machine Learning** | Python, FastAPI, scikit-learn, joblib | Python 3.12 / FastAPI 0.104 | Real-time behavioral fraud and scalper detection |
| **Database & Auth** | Supabase, PostgreSQL, GoTrue, RLS | PostgreSQL 15 | Row-level security, edge functions, session tracking |
| **Smart Contracts** | Solidity, Hardhat, OpenZeppelin | Solidity 0.8.20 | ERC-721 ticket NFTs, price-capped resale rules |
| **Blockchain Network** | Polygon Amoy Testnet | Chain ID 80002 | Low-gas, high-throughput on-chain settlement |
| **Payments** | Razorpay Node SDK (Test Mode) | API v1 | Indian payment rails (UPI, Cards, Netbanking) |
| **Workflow Engine** | n8n | Self-hosted | Webhook triggers, email notifications, audit alerts |

---

## ⚡ Quick Start

### Prerequisites

- **Node.js**: `>= 18.0.0` (Recommended: Node 20 or 24 LTS)
- **Python**: `>= 3.10` (Recommended: Python 3.12)
- **Git**

### 1. Clone & Configure Environment

```bash
git clone https://github.com/your-username/TruTicket.git
cd TruTicket

# Copy environment variables template
cp .env.example .env
cp apps/web/.env.local apps/web/.env.local.bak # optional
```

Ensure `.env` contains the required ports and services:
```env
# ML Service
ML_SERVICE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_ML_SERVICE_URL=http://127.0.0.1:8000

# Web & Mobile
NEXT_PUBLIC_APP_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://oviqjnzlgbkmggytaqao.supabase.co
```

### 2. Install Dependencies

```bash
# Install workspace dependencies (Web, Mobile, Contracts)
npm install

# (Optional) Install Python ML dependencies if running in a separate venv:
python -m pip install fastapi uvicorn scikit-learn pydantic numpy joblib
```

### 3. Run the Entire Project (One Command)

The unified runner coordinates the ML FastAPI service, Next.js Web App, and Expo Metro Bundler simultaneously with piped colored output:

```bash
npm run dev
```

*Or launch individual services independently:*

```bash
# Terminal 1: ML Risk Service (:8000)
npm run dev:ml

# Terminal 2: Web App (:3000)
npm run dev:web

# Terminal 3: Mobile App Metro Bundler (:8081)
npm run dev:mobile
```

---

## 🌐 Live Service URLs

| Service / Dashboard | URL | Description |
| :--- | :--- | :--- |
| **Web Portal & Discovery** | [http://localhost:3000](http://localhost:3000) | Attendee landing, event discovery, ticket purchasing |
| **Admin Risk Queue** | [http://localhost:3000/admin/risk](http://localhost:3000/admin/risk) | Live ML risk queue & interactive bot simulator |
| **Organiser Fraud Dashboard** | [http://localhost:3000/organiser/fraud](http://localhost:3000/organiser/fraud) | Event-level suspicious session monitoring & scan feed |
| **Connection Diagnostics** | [http://localhost:3000/status](http://localhost:3000/status) | Real-time reachability probes across Backend & ML |
| **FastAPI Swagger Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive OpenAPI documentation for ML endpoints |
| **Mobile Metro Bundler** | [http://localhost:8081](http://localhost:8081) | Expo Dev Tools & Metro packager for iOS/Android |

---

## 📁 Repository Structure

```
TruTicket/
├── apps/
│   ├── mobile/                    # React Native Expo app (SDK 57)
│   │   ├── src/app/               # Expo Router file-based screens
│   │   ├── src/components/        # Reusable NativeWind UI components
│   │   ├── src/services/          # API, checkout, gate scanner, ML clients
│   │   └── app.json               # Expo application configuration
│   └── web/                       # Next.js 15 full-stack web application
│       ├── src/app/               # App Router pages ((buyer), admin, organiser)
│       │   ├── admin/risk/        # Live ML Risk Queue & Interactive Simulator
│       │   ├── organiser/fraud/   # Organiser Fraud Monitoring Dashboard
│       │   ├── status/            # System connectivity diagnostic suite
│       │   └── api/ml/[...path]/  # High-performance Next.js to ML API gateway
│       └── src/lib/               # ML client, API utilities, admin data
├── services/
│   ├── ml/                        # Production FastAPI ML Risk Service
│   │   ├── main.py                # Service endpoints (/health, /score, /predict, /simulate)
│   │   ├── models/                # Trained Random Forest joblib pipeline
│   │   └── src/                   # Kinematic rules engine, hybrid scorer, configs
│   └── api/                       # Supabase Backend
│       └── supabase/functions/    # Deno Edge Functions (auth, orders, tickets, risk)
├── contracts/                     # Hardhat smart contracts environment
│   ├── contracts/TruTicket.sol    # ERC-721 ticket contract with on-chain resale caps
│   ├── test/TruTicket.test.js     # Comprehensive unit tests (mint, resale, redeem, pause)
│   └── hardhat.config.js          # Polygon Amoy network configuration
├── docs/                          # Engineering specs, PRDs, architecture guides
├── infra/                         # Dockerfiles, deployment manifests, n8n config
├── scripts/
│   └── start-all.js               # Unified full-stack process runner
└── package.json                   # Root monorepo workspace configuration
```

---

## 🔗 API & Contracts

### 1. ML Risk API Contracts

```http
POST /score HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "session_id": "sess_97hf7ciplt2k54f5j6109nek",
  "mouse_total_moves": 8332,
  "mouse_straightness": 0.0045,
  "mouse_dist_mean": 5.95,
  "mouse_direction_changes": 795,
  "mouse_speed_mean_px_s": 542.0,
  "mouse_speed_std_px_s": 1190.0,
  "log_total_requests": 184,
  "log_requests_per_second": 0.727
}
```

**Response (HTTP 200 OK):**
```json
{
  "session_id": "sess_97hf7ciplt2k54f5j6109nek",
  "predicted_class": "human",
  "class_probabilities": {
    "human": 0.7233,
    "moderate_bot": 0.0467,
    "advanced_bot": 0.2300
  },
  "risk_score": 19.9,
  "risk_band": "LOW",
  "reason_codes": [
    "CONFIRMED_ORGANIC_HUMAN_KINEMATICS"
  ],
  "model_version": "1.0.0-rf-hybrid",
  "action_recommendation": "ALLOW: Frictionless checkout path granted."
}
```

### 2. Smart Contract Key Functions

```solidity
// Mint ticket with immutable face value and resale cap
function mint(address to, uint256 eventId, uint256 tierId, uint256 faceValue) external onlyRole(MINTER_ROLE) returns (uint256);

// List ticket for resale (reverts if price exceeds event policy cap)
function listForResale(uint256 tokenId, uint256 resalePrice) external;

// Atomic ticket settlement via marketplace escrow
function settleResale(uint256 tokenId, address buyer) external payable onlyRole(MARKETPLACE_ROLE);

// Single-use turnstile redemption by verified gate scanner
function redeem(uint256 tokenId) external onlyRole(VERIFIER_ROLE);
```

---

## 🧪 Verification & Testing

Every subsystem contains rigorous unit and integration test suites:

```bash
# 1. Run Machine Learning unit & API contract tests
python -m unittest "ML Model/truticket_ml/tests/test_ml_pipeline.py"
python -m unittest "ML Model/truticket_ml/tests/test_api.py"
# Result: 16/16 PASS (100% test coverage for scoring & kinematics)

# 2. Compile and test Solidity smart contracts
npm run contracts:compile
npm run contracts:test
# Result: 34/34 PASS (Minting, Transfers, Resale Caps, Atomic Redemption, Pausing)

# 3. Typecheck Web and Mobile workspaces
npm --workspace=apps/web run typecheck
npm --workspace=apps/mobile run typecheck
# Result: 0 TypeScript errors across all workspaces

# 4. Production Next.js Build
npm --workspace=apps/web run build
# Result: 25/25 static & dynamic routes compiled cleanly
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
