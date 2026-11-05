# TruTicket API Contracts

All endpoints are Supabase Edge Functions. Frontend must never bypass these.

## Authentication
```
POST /auth/signup    { email, password, role }
POST /auth/signin    { email, password }
GET  /auth/me        (Authorization: Bearer <jwt>)
```

## Events
```
GET    /events                          # Public — list events
GET    /events/:id                      # Public — event detail
POST   /events                          # Organizer — create event
POST   /ticket-types                    # Organizer — create ticket type
```

## FairQueue
```
POST   /queue/join                      # Attendee — join waiting room
GET    /queue/status/:eventId           # Attendee — check queue position
```

## Checkout & Payments
```
POST   /checkout                        # Attendee — create checkout session
POST   /payments/webhook                # Razorpay — server-side verification
GET    /orders/:id                      # Attendee — order status
```

## Tickets & Wallet
```
GET    /me/tickets                      # Attendee — list tickets
GET    /tickets/:id                     # Attendee — ticket detail + Ticket DNA
POST   /tickets/:id/credential          # Owner — issue dynamic QR
GET    /verify/:ticketRef               # Public/rate-limited — privacy-safe status
```

## Resale Marketplace
```
POST   /resale/listings                 # Owner — list for resale
POST   /resale/listings/:id/purchase    # Buyer — purchase listing
DELETE /resale/listings/:id             # Seller — cancel listing
GET    /resale/listings                 # Public — browse active listings
```

## Gate Scanner
```
POST   /scanner/verify                  # Verifier — validate + redeem QR
GET    /scanner/history/:eventId        # Organizer — gate scan logs
```

## Organizer
```
GET    /organizer/events/:id/analytics  # Organizer — event metrics
GET    /organizer/events/:id/fraud-events # Organizer/Reviewer — fraud events
POST   /organizer/events/:id/pause      # Admin — emergency pause
```

## Admin
```
GET    /admin/users                     # Platform Admin — user management
GET    /admin/audit-logs                # Platform Admin — audit trail
POST   /admin/emergency-pause           # Platform Admin — multi-sig pause
```

## ML Risk
```
POST   /ml/predict                      # Internal — risk scoring
```

## Error Response Format
```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-11-05T10:00:00Z"
}
```

## Security Notes
- All state-changing endpoints require valid JWT
- Row Level Security (RLS) enforced at database level
- Idempotency keys required for payment operations
- Rate limits: 10 req/min per IP for public endpoints