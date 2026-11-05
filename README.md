# TruTicket

**Fair access. Genuine tickets. Controlled resale.**

A production-grade event-ticketing platform with:
- **Mobile App** (React Native + Expo) for attendees & gate scanners
- **Web App** (Next.js) for organizers, admins, and fraud reviewers
- **Backend** (Supabase + Edge Functions) for API, auth, and database
- **Blockchain** (Solidity + Polygon Amoy) for ticket NFTs & price-capped resale
- **ML Service** (FastAPI + scikit-learn) for bot risk scoring
- **Automation** (n8n) for webhooks and notifications

## Team
| Member | Role |
|--------|------|
| Brajesh | Backend & Blockchain Lead |
| Ansh | Mobile Frontend Lead |
| Shivam | Web Frontend Lead |
| Anany | ML & Security Lead |

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env with your actual values

# 2. Install dependencies
npm install

# 3. Setup database
npm run db:generate
npm run db:push

# 4. Deploy smart contracts
npm run contracts:compile
npm run contracts:test

# 5. Start development servers
npm run dev:web      # Next.js on :3000
npm run dev:mobile   # Expo on :8081
npm run dev:ml       # FastAPI on :8000
```

## Repository Structure

```
TruTicket/
├── apps/mobile/       # React Native Expo (iOS + Android)
├── apps/web/          # Next.js 14 (Customer + Organizer + Admin)
├── services/api/      # Supabase Edge Functions
├── services/ml/       # FastAPI ML Risk Service
├── contracts/         # Solidity Smart Contracts
├── prisma/            # Database Schema & Migrations
├── docs/              # Architecture & API Contracts
├── n8n/               # Automation Workflows
└── infra/             # Docker & Deployment Config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo SDK 51+) + TypeScript + NativeWind |
| Web | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Database | Supabase PostgreSQL + Row Level Security |
| Auth | Supabase Auth (GoTrue) + JWT |
| Blockchain | Solidity + OpenZeppelin + Hardhat + Polygon Amoy |
| ML | Python + FastAPI + scikit-learn |
| Automation | n8n |
| Payments | Razorpay Test Mode (India) |

## License

MIT