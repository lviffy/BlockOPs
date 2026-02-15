#!/bin/bash

# Script to stop all BlockOps services
set -e

echo "🛑 Stopping BlockOps Services..."

# Stop Docker containers for AI_workflow_backend
echo "🐳 Stopping AI_workflow_backend..."
cd /home/lviffy/Projects/blockops/AI_workflow_backend
sudo docker-compose down
echo "✅ AI_workflow_backend stopped"

# Stop Docker containers for n8n_agent_backend
echo "🐳 Stopping n8n_agent_backend..."
cd /home/lviffy/Projects/blockops/n8n_agent_backend
sudo docker-compose down
echo "✅ n8n_agent_backend stopped"

# Stop Docker containers for orbit_ai_backend
echo "🐳 Stopping orbit_ai_backend..."
cd /home/lviffy/Projects/blockops/orbit_ai_backend
sudo docker-compose down
echo "✅ orbit_ai_backend stopped"

# Kill backend and frontend Node processes
echo "📦 Stopping backend and frontend..."
pkill -f "npm start" || echo "No backend process found"
pkill -f "npm run dev" || echo "No frontend process found"
pkill -f "next dev" || echo "No Next.js process found"
echo "✅ Node processes stopped"

echo ""
echo "✨ All services stopped successfully!"
echo ""
