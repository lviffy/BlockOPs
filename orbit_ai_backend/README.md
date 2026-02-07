# Orbit AI Backend

A dedicated FastAPI service for conversational L3 chain deployment.

## Quick Start

```bash
docker-compose up -d
```

## Endpoints

- `GET /` - Health check
- `POST /api/orbit-ai/chat` - Main conversation endpoint
- `GET /api/orbit-ai/session/{id}` - Get session
- `POST /api/orbit-ai/session/{id}/reset` - Reset session
- `GET /api/orbit-ai/presets` - Use-case presets
- `POST /api/orbit-ai/deploy` - Deploy (proxy)
- `GET /api/orbit-ai/deploy/status/{id}` - Deployment status

## Environment Variables

```env
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
BACKEND_URL=http://localhost:3000
SESSION_TTL_SECONDS=7200
```
