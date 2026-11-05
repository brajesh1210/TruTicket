# TruTicket — Team Handoff Guide

## Member Responsibilities

### Brajesh — Backend & Blockchain Lead
- Supabase PostgreSQL schema (prisma/schema.prisma)
- Row Level Security (RLS) policies
- Supabase Edge Functions (services/api/supabase/functions/)
- Smart contracts (contracts/TruTicket.sol) + Hardhat tests
- Razorpay webhook integration
- n8n workflows (n8n/workflows/)
- Database migrations and seeding

### Ansh — Mobile Frontend Lead (React Native/Expo)
- apps/mobile/ — all screens and navigation
- Auth flow, Explore, Event Detail, MyTickets, TicketDetail, Scanner
- NativeWind styling, Zustand state management
- QR scanner integration (expo-camera)
- Supabase client integration

### Shivam — Web Frontend Lead (Next.js)
- apps/web/ — all pages and components
- Customer views, Organizer Dashboard, Admin Dashboard, Scanner Web
- Tailwind + shadcn/ui, responsive design
- Next.js App Router, server actions

### Anany — ML & Security Lead
- services/ml/ — FastAPI risk scoring service
- Synthetic dataset generation
- Random Forest model training
- Reason codes: RAPID_CHECKOUT_CADENCE, IP_BURST_RATE_EXCEEDED
- Security threat testing (replay, forged signatures, privilege escalation)

## Collaboration Rules
1. Feature branches + small PRs (max 2-3 days per PR)
2. Never commit secrets, private keys, or production data
3. Shared .env.example with placeholder values only
4. Keep main branch working; integrate at least daily
5. Seeded demo accounts for deterministic testing
6. Record status as implemented / simulated / roadmap
7. Daily standup: what done, what blocked, what next

## Getting Started
```bash
cp .env.example .env
# Fill in your values
npm install
npm run db:generate
npm run db:push
npm run dev:web
```