# BlockOps - Product Requirements Document (PRD)
## Complete System Design & Architecture

**Version:** 1.0  
**Last Updated:** November 2025
**Status:** Active Development

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [User Flows](#user-flows)
6. [Feature Specifications](#feature-specifications)
7. [API Specifications](#api-specifications)
8. [Technical Stack](#technical-stack)
9. [Security & Privacy](#security--privacy)
10. [Performance Requirements](#performance-requirements)
11. [Deployment & Infrastructure](#deployment--infrastructure)
12. [Roadmap & Future Enhancements](#roadmap--future-enhancements)

---

## 1. Executive Summary

**BlockOps** is a no-code platform that enables users to build, deploy, and interact with AI-powered blockchain agents on the BlockOps testnet. Users can create sophisticated blockchain automation workflows through a visual drag-and-drop interface without writing any code.

### Key Value Propositions
- **No-Code Solution**: Build blockchain agents visually
- **AI-Powered**: Natural language agent generation
- **10+ Blockchain Tools**: Comprehensive DeFi and NFT capabilities
- **User-Friendly**: Intuitive drag-and-drop workflow builder
- **API Access**: Interact with agents via REST API

---

## 2. Product Overview

### 2.1 Target Users
- **Primary**: Non-technical users wanting to automate blockchain operations
- **Secondary**: Developers seeking rapid blockchain automation prototyping
- **Tertiary**: Businesses needing blockchain workflow automation

### 2.2 Core Features
1. **Visual Workflow Builder** - Drag-and-drop tool connection
2. **AI Agent Generation** - Natural language to workflow conversion
3. **Wallet Management** - Create or import agent wallets
4. **Agent Chat Interface** - Interactive agent communication
5. **API Access** - Programmatic agent interaction
6. **Agent Management** - Create, edit, delete, and organize agents

### 2.3 Supported Blockchain Tools
1. **Transfer** - Native token and ERC-20 transfers
2. **Swap** - Token swaps via Uniswap V2/V3
3. **Get Balance** - Wallet balance queries
4. **Deploy ERC-20** - Token creation via factory
5. **Deploy ERC-721** - NFT collection creation
6. **Create DAO** - Decentralized organization creation
7. **Airdrop** - Batch token distribution
8. **Fetch Price** - Cryptocurrency price queries
9. **Deposit Yield** - Yield farming deposits
10. **Wallet Analytics** - Comprehensive wallet analysis

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (Next.js 15)                                │  │
│  │  - Workflow Builder (React Flow)                      │  │
│  │  - Agent Management Dashboard                        │  │
│  │  - Chat Interface                                     │  │
│  │  - Wallet Management                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI SERVICES LAYER                          │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  Agent Service        │  │  Workflow Builder Service   │ │
│  │  (FastAPI)            │  │  (FastAPI)                  │ │
│  │  - Tool Execution     │  │  - NLP to Workflow         │ │
│  │  - OpenAI Integration │  │  - Workflow Validation     │ │
│  │  - Context Management │  │  - Tool Recommendations    │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Backend API (Express.js)                             │  │
│  │  - Blockchain Operations                               │  │
│  │  - Smart Contract Interactions                        │  │
│  │  - IPFS Integration                                   │  │
│  │  - External API Calls                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ RPC Calls / HTTP
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BLOCKCHAIN & EXTERNAL SERVICES                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ BlockOps     │  │ OpenAI API   │  │ Pinata IPFS  │      │
│  │ Testnet      │  │ (GPT-4o)     │  │              │      │
│  │              │  │              │  │              │      │
│  │ - Factories  │  │ - Chat       │  │ - Metadata   │      │
│  │ - Contracts  │  │ - Function   │  │   Storage    │      │
│  │ - Router     │  │   Calling    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Supabase (PostgreSQL)                               │  │
│  │  - Users, Agents, Conversations                      │  │
│  │  - Messages, Executions, Analytics                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Privy (Authentication)                               │  │
│  │  - User Authentication                                │  │
│  │  - Wallet Connection                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Breakdown

#### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19, Tailwind CSS, shadcn/ui
- **Workflow Builder**: React Flow
- **State Management**: React Hooks, Zustand (if needed)
- **Authentication**: Privy React Auth
- **Database Client**: Supabase JS

#### AI Services (FastAPI)
- **Agent Service**: Tool execution orchestration
- **Workflow Builder Service**: NLP to workflow conversion
- **OpenAI Integration**: GPT-4o for chat and function calling

#### Backend API (Express.js)
- **Blockchain Operations**: ethers.js v6
- **Smart Contract Interaction**: Direct contract calls
- **IPFS Integration**: Pinata API
- **External APIs**: Price fetching, subgraph queries

#### Database (Supabase PostgreSQL)
- **Tables**: users, agents, conversations, messages, executions
- **Authentication**: Privy (external)
- **Storage**: Supabase Storage (if needed for files)

---

## 4. Database Schema

### 4.1 Core Tables

#### `users`
- **Purpose**: Store user information from Privy
- **Key Fields**:
  - `id` (UUID, PK): Privy user ID
  - `private_key` (TEXT): Encrypted agent wallet private key
  - `wallet_address` (TEXT): Agent wallet address
  - `created_at`, `updated_at` (TIMESTAMP)

#### `agents`
- **Purpose**: Store AI agent configurations
- **Key Fields**:
  - `id` (UUID, PK): Agent identifier
  - `user_id` (UUID, FK): Owner user
  - `name` (TEXT): Agent name
  - `description` (TEXT): Agent description
  - `api_key` (TEXT, UNIQUE): API access key
  - `tools` (JSONB): Array of tool configurations
  - `status` (TEXT): active, paused, archived
  - `created_at`, `updated_at` (TIMESTAMP)

#### `conversations` (Optional)
- **Purpose**: Store chat conversation sessions
- **Key Fields**:
  - `id` (UUID, PK)
  - `agent_id` (UUID, FK)
  - `user_id` (UUID, FK)
  - `title` (TEXT): Auto-generated title
  - `created_at`, `updated_at` (TIMESTAMP)

#### `messages` (Optional)
- **Purpose**: Store individual chat messages
- **Key Fields**:
  - `id` (UUID, PK)
  - `conversation_id` (UUID, FK)
  - `role` (TEXT): user | assistant
  - `content` (TEXT): Message content
  - `agent_response` (JSONB): Full agent response
  - `created_at` (TIMESTAMP)

#### `agent_executions` (Optional)
- **Purpose**: Track agent execution history
- **Key Fields**:
  - `id` (UUID, PK)
  - `agent_id` (UUID, FK)
  - `user_id` (UUID, FK)
  - `user_message` (TEXT)
  - `agent_response` (TEXT)
  - `tool_calls_count` (INTEGER)
  - `execution_time_ms` (INTEGER)
  - `success` (BOOLEAN)
  - `error_message` (TEXT)
  - `created_at` (TIMESTAMP)

#### `tool_executions` (Optional)
- **Purpose**: Track individual tool executions
- **Key Fields**:
  - `id` (UUID, PK)
  - `execution_id` (UUID, FK)
  - `tool_name` (TEXT)
  - `parameters` (JSONB)
  - `result` (JSONB)
  - `success` (BOOLEAN)
  - `execution_time_ms` (INTEGER)
  - `transaction_hash` (TEXT)
  - `error_message` (TEXT)
  - `created_at` (TIMESTAMP)

#### `api_usage` (Optional)
- **Purpose**: Track API usage for analytics and rate limiting
- **Key Fields**:
  - `id` (UUID, PK)
  - `agent_id` (UUID, FK)
  - `api_key` (TEXT)
  - `endpoint` (TEXT)
  - `ip_address` (INET)
  - `user_agent` (TEXT)
  - `response_status` (INTEGER)
  - `created_at` (TIMESTAMP)

### 4.2 Relationships
```
users (1) ──< (many) agents
agents (1) ──< (many) conversations
conversations (1) ──< (many) messages
agents (1) ──< (many) agent_executions
agent_executions (1) ──< (many) tool_executions
agents (1) ──< (many) api_usage
```

---

## 5. User Flows

### 5.1 New User Onboarding
1. User visits platform
2. Clicks "Get Started"
3. Connects wallet via Privy (MetaMask)
4. System creates user record in Supabase
5. User redirected to dashboard

### 5.2 Agent Creation Flow
1. User clicks "Create Agent"
2. User chooses:
   - **Option A**: Visual builder (drag-drop tools)
   - **Option B**: AI generation (describe in natural language)
3. If Option B:
   - User describes agent requirements
   - AI generates workflow
   - User reviews and edits
4. User configures tool parameters
5. User saves agent
6. System generates API key
7. Agent is ready to use

### 5.3 Agent Interaction Flow
1. User selects agent from dashboard
2. User opens chat interface
3. User sends message
4. Frontend sends to Agent Service with API key
5. Agent Service:
   - Validates API key
   - Calls OpenAI with tool definitions
   - Receives tool calls
   - Executes tools via Backend API
   - Returns results to OpenAI
   - Gets final response
6. Response displayed to user

### 5.4 API Usage Flow
1. Developer gets API key from agent settings
2. Developer makes POST request to `/agent/chat`
3. Backend validates API key
4. Same flow as chat interface (steps 5-6 above)
5. JSON response returned

---

## 6. Feature Specifications

### 6.1 Workflow Builder
**Requirements**:
- Drag-and-drop interface
- Visual tool connection
- Tool parameter configuration
- Workflow validation
- Save/load workflows
- Export workflow as JSON

**Tools Available**:
1. Transfer Tool
2. Swap Tool
3. Get Balance Tool
4. Deploy ERC-20 Tool
5. Deploy ERC-721 Tool
6. Create DAO Tool
7. Airdrop Tool
8. Fetch Price Tool
9. Deposit Yield Tool
10. Wallet Analytics Tool

### 6.2 AI Agent Generation
**Requirements**:
- Natural language input
- AI converts to workflow
- Tool recommendations
- Parameter suggestions
- Workflow preview
- Edit before saving

**AI Service Endpoints**:
- `POST /create-workflow` - Convert NL to workflow
- `GET /available-tools` - List available tools

### 6.3 Wallet Management
**Requirements**:
- Create new agent wallet
- Import existing wallet (private key)
- View wallet address
- View wallet balance
- Remove wallet

**Security**:
- Private keys encrypted at rest
- Never exposed in frontend
- Stored in Supabase (encrypted)

### 6.4 Agent Chat Interface
**Requirements**:
- Real-time chat UI
- Message history
- Tool execution visualization
- Transaction links
- Error handling
- Loading states

### 6.5 Agent Management
**Requirements**:
- List all user agents
- View agent details
- Edit agent (name, description, tools)
- Delete agent
- Copy API key
- View agent usage stats

---

## 7. API Specifications

### 7.1 Frontend → Agent Service

#### `POST /agent/chat`
**Request**:
```json
{
  "api_key": "string",
  "user_message": "string"
}
```

**Response**:
```json
{
  "agent_response": "string",
  "tool_calls": [
    {
      "tool": "string",
      "parameters": {}
    }
  ],
  "results": [
    {
      "success": boolean,
      "tool": "string",
      "result": {}
    }
  ]
}
```

### 7.2 Frontend → Workflow Builder Service

#### `POST /create-workflow`
**Request**:
```json
{
  "description": "string"
}
```

**Response**:
```json
{
  "workflow": {
    "nodes": [],
    "edges": [],
    "tools": []
  }
}
```

### 7.3 Frontend → Backend API

#### `POST /transfer`
#### `POST /swap`
#### `POST /deploy-token`
#### `POST /create-nft-collection`
#### `POST /create-dao`
#### `POST /airdrop`
#### `POST /token-price`
#### `POST /yield`
#### `GET /balance/:address`
#### `POST /api/balance/erc20`

(All endpoints documented in main README.md)

---

## 8. Technical Stack

### Frontend
- **Framework**: Next.js 15
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **Workflow**: React Flow
- **Auth**: Privy React Auth
- **Database**: Supabase JS Client

### AI Services
- **Framework**: FastAPI (Python)
- **AI**: OpenAI GPT-4o
- **HTTP**: Python requests

### Backend API
- **Framework**: Express.js
- **Language**: JavaScript/TypeScript
- **Blockchain**: ethers.js v6
- **IPFS**: Pinata API
- **HTTP**: Axios

### Database
- **Provider**: Supabase (PostgreSQL)
- **Auth**: Privy (external)

### Infrastructure
- **Frontend Hosting**: Vercel (recommended)
- **Backend Hosting**: Railway / Render / AWS
- **Database**: Supabase
- **Blockchain**: BlockOps Testnet

---

## 9. Security & Privacy

### 9.1 Authentication
- **Method**: Privy (wallet-based)
- **Session Management**: Privy handles sessions
- **No Supabase Auth**: Using Privy instead

### 9.2 Data Security
- **Private Keys**: Encrypted at rest
- **API Keys**: Stored securely, never exposed in URLs
- **RLS**: Disabled (Privy handles auth)
- **Application-Level Security**: Frontend validates user ownership

### 9.3 API Security
- **API Key Validation**: Required for all agent endpoints
- **Rate Limiting**: Implement per API key
- **CORS**: Configured for frontend domain
- **Input Validation**: All inputs validated

### 9.4 Privacy
- **User Data**: Stored in Supabase
- **Chat History**: Optional, user-controlled
- **Analytics**: Optional, anonymized

---

## 10. Performance Requirements

### 10.1 Response Times
- **Page Load**: < 2 seconds
- **Agent Response**: < 10 seconds (depends on tool execution)
- **Tool Execution**: < 5 seconds per tool
- **Workflow Generation**: < 15 seconds

### 10.2 Scalability
- **Concurrent Users**: Support 1000+ concurrent users
- **API Requests**: Handle 10,000+ requests/hour
- **Database**: Optimized queries with indexes

### 10.3 Caching
- **Frontend**: Next.js automatic caching
- **API**: Cache tool results where appropriate
- **Database**: Query optimization

---

## 11. Deployment & Infrastructure

### 11.1 Environment Variables

#### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_PRIVY_APP_ID=
```

#### Backend API (.env)
```env
PORT=3000
BLOCKOPS_RPC_URL=https://dream-rpc.somnia.network
PINATA_API_KEY=
PINATA_SECRET_KEY=
OPENAI_API_KEY=
```

#### Agent Service (.env)
```env
PORT=8000
BACKEND_API_URL=http://localhost:3000
OPENAI_API_KEY=
```

#### Workflow Builder Service (.env)
```env
PORT=8001
OPENAI_API_KEY=
```

### 11.2 Deployment Steps

1. **Database Setup**
   - Create Supabase project
   - Run `DATABASE_SCHEMA.sql`
   - Configure credentials

2. **Frontend Deployment**
   - Deploy to Vercel
   - Configure environment variables
   - Set up custom domain

3. **Backend Deployment**
   - Deploy to Railway/Render
   - Configure environment variables
   - Set up health checks

4. **AI Services Deployment**
   - Deploy to Railway/Render
   - Configure environment variables
   - Connect to Backend API

---

## 12. Roadmap & Future Enhancements

### Phase 1 (Current)
- ✅ Basic workflow builder
- ✅ 10 blockchain tools
- ✅ AI agent generation
- ✅ Agent chat interface
- ✅ API access

### Phase 2 (Next)
- [ ] Chat history persistence
- [ ] Agent analytics dashboard
- [ ] Workflow templates
- [ ] Multi-chain support
- [ ] Agent sharing/marketplace

### Phase 3 (Future)
- [ ] Advanced workflow logic (conditionals, loops)
- [ ] Scheduled agent execution
- [ ] Agent collaboration
- [ ] Mobile app
- [ ] Enterprise features

---

## Appendix A: Database Setup Instructions

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Copy and paste `DATABASE_SCHEMA.sql`
4. Run the script
5. Verify tables created
6. Configure environment variables

---

## Appendix B: API Key Format

API keys are 32-character alphanumeric strings:
- Format: `[A-Za-z0-9]{32}`
- Example: `aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3`
- Generated on agent creation
- Unique per agent
- Used for API authentication

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Maintained By**: Development Team

