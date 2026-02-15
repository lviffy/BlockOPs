#!/bin/bash

# Script to start all BlockOps services
set -e

echo "🚀 Starting BlockOps Services..."

# Start backend with npm start
echo "📦 Starting backend..."
cd /home/lviffy/Projects/blockops/backend
npm start &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait a bit for backend to initialize
sleep 3

# Start AI_workflow_backend with docker compose
echo "🐳 Starting AI_workflow_backend..."
cd /home/lviffy/Projects/blockops/AI_workflow_backend
sudo docker-compose down
sudo docker-compose up -d
echo "✅ AI_workflow_backend started"

# Start n8n_agent_backend with docker compose
echo "🐳 Starting n8n_agent_backend..."
cd /home/lviffy/Projects/blockops/n8n_agent_backend
sudo docker-compose down
sudo docker-compose up -d
echo "✅ n8n_agent_backend started"

# Start orbit_ai_backend with docker compose
echo "🐳 Starting orbit_ai_backend..."
cd /home/lviffy/Projects/blockops/orbit_ai_backend
sudo docker-compose down
sudo docker-compose up -d
echo "✅ orbit_ai_backend started"

# Start frontend with npm run dev
echo "⚛️  Starting frontend..."
cd /home/lviffy/Projects/blockops/frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "✨ All services started successfully!"
echo ""
echo "Service URLs (typical):"
echo "  Backend: http://localhost:3001"
echo "  Frontend: http://localhost:3000"
echo ""
echo "To stop all services, run: ./stop-all.sh"
echo ""
