# WinTube v2.0 — Secure Watch & Earn Platform

## Project Overview
- **Name**: WinTube
- **Goal**: Secure watch-and-earn platform where users earn points by watching videos
- **Tech Stack**: Hono + TypeScript + Cloudflare Workers + D1 Database
- **Version**: 2.0.0 (Complete security rewrite)

## Live URLs
- **Sandbox**: https://3000-id0i76ej1exnchcktrxgj-c07dda5e.sandbox.novita.ai

## Security Improvements (v1 → v2)

| Issue | v1 (Old) | v2 (New) |
|-------|---------|---------|
| YouTube API Key | Exposed in frontend JS | Hidden in server env vars |
| Points Logic | Client-side `userPoints++` | Server-side with DB validation |
| Authentication | Firebase client-only | Server-side sessions with PBKDF2 |
| Rate Limiting | None | Per-action limits (heartbeat, login, claims) |
| Data Storage | Firestore (client writes) | D1 Database (server writes only) |
| Admin ID | Hardcoded in frontend | Environment variable |
| Watch Verification | Timer only | Server heartbeat with time validation |
| Withdrawal | No balance check | Server-side balance verification + atomic transactions |

## Architecture

```
Frontend (HTML/CSS/JS)
    │
    ├── /api/auth/*       → Authentication (register, login, sessions)
    ├── /api/videos/*     → YouTube API Proxy (hides API key)
    ├── /api/points/*     → Points system (server-validated)
    ├── /api/leaderboard  → Public leaderboard
    └── /api/withdraw     → Withdrawal system
    │
    └── D1 Database (SQLite)
        ├── users
        ├── sessions
        ├── point_transactions
        ├── rate_limits
        ├── watch_sessions
        ├── offer_claims
        └── withdrawals
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account (name, email, password, referralCode?)
- `POST /api/auth/login` — Sign in (email, password)
- `POST /api/auth/logout` — End session
- `GET /api/auth/me` — Get current user (requires token)

### Videos (YouTube Proxy)
- `GET /api/videos/feed?pageToken=` — Get shorts feed
- `GET /api/videos/search?q=` — Search videos

### Points (requires auth)
- `GET /api/points/balance` — Get current balance
- `POST /api/points/watch/start` — Start watch session (videoId)
- `POST /api/points/watch/heartbeat` — Earn point from watching (sessionId)
- `POST /api/points/claim/smart-offer` — Claim smart offer (+50 pts)
- `POST /api/points/claim/ad-watch` — Claim ad watch (+20 pts)
- `GET /api/points/history` — Transaction history

### Social
- `GET /api/leaderboard` — Top 20 users
- `POST /api/withdraw` — Request withdrawal (amount, method, address)
- `GET /api/withdrawals` — User's withdrawal history

## Security Features

1. **Server-side Points**: All point operations happen on the server with D1
2. **Rate Limiting**: Per-user, per-action limits stored in database
3. **Watch Verification**: Server tracks heartbeats with minimum time intervals
4. **Hourly Caps**: Max 120 points/hour from watching
5. **PBKDF2 Password Hashing**: 100,000 iterations with random salt
6. **Session Management**: 72-hour sessions, max 5 per user
7. **Atomic Transactions**: Withdrawals use batch operations
8. **Input Validation**: All inputs sanitized and validated
9. **API Key Protection**: YouTube API key never sent to client

## Configuration

### Environment Variables (Production)
```bash
wrangler secret put YT_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_UIDS
```

### Local Development
Create `.dev.vars` file:
```
YT_API_KEY=your-youtube-api-key
JWT_SECRET=your-secret-key
ADMIN_UIDS=admin-user-id
```

## Development

```bash
# Install dependencies
npm install

# Apply database migrations
npm run db:migrate:local

# Seed test data
npm run db:seed

# Build
npm run build

# Start dev server
npm run dev:sandbox

# Reset database
npm run db:reset
```

## Deployment
- **Platform**: Cloudflare Pages
- **Database**: Cloudflare D1
- **Status**: Development
- **Last Updated**: 2026-03-18
