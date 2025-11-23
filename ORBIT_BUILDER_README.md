# Arbitrum Orbit L3 Builder Feature

## 🚀 Overview

The **Arbitrum Orbit L3 Builder** is a powerful feature that allows users to create and deploy custom Layer 3 (L3) chains on Arbitrum with a simple, intuitive interface. This feature leverages Arbitrum Orbit technology to provide full control over chain parameters, validators, and governance.

## ✨ Features

- **Visual Configuration**: Easy-to-use form interface for L3 chain configuration
- **Flexible Parameters**: Customize chain ID, validators, gas prices, and more
- **One-Click Deployment**: Deploy your L3 chain with a single button click
- **Real-time Status**: Monitor deployment progress with live updates
- **Configuration Management**: Save, edit, and manage multiple L3 configurations
- **Deployment History**: Track all your L3 chain deployments

## 📁 Project Structure

```
backend/
├── controllers/
│   └── orbitController.js       # L3 config and deployment logic
├── routes/
│   └── orbitRoutes.js           # API endpoints for Orbit operations
└── utils/
    └── orbitDeployer.js         # Orbit SDK integration and deployment

frontend/
├── app/
│   └── orbit-builder/
│       └── page.tsx             # Main Orbit Builder page
└── components/
    └── orbit/
        ├── OrbitConfigForm.tsx  # Configuration form
        ├── DeploymentStatus.tsx # Deployment status tracker
        └── ConfigList.tsx       # List of configurations

migrations/
└── orbit_builder_schema.sql     # Database schema for orbit tables
```

## 🔧 API Endpoints

### Configuration Management

```
POST   /api/orbit/config              Create new L3 configuration
GET    /api/orbit/config/:id          Get configuration by ID
GET    /api/orbit/configs             List all configurations
PUT    /api/orbit/config/:id          Update configuration
DELETE /api/orbit/config/:id          Delete configuration
POST   /api/orbit/config/:id/validate Validate configuration
```

### Deployment

```
POST   /api/orbit/deploy              Deploy L3 chain
GET    /api/orbit/deploy/status/:id  Get deployment status
```

## 🎨 Frontend Components

### 1. OrbitConfigForm
Main configuration form with sections for:
- Basic Information (name, chain ID, description)
- Chain Governance (owner, sequencer, validators)
- Advanced Settings (gas prices, native token)

### 2. DeploymentStatus
Real-time deployment status with:
- Progress bar
- Deployment logs
- Transaction details
- RPC and explorer URLs

### 3. ConfigList
Manage your configurations:
- View all saved configs
- Deploy configurations
- Delete draft configurations

## 💾 Database Schema

### orbit_configs Table
Stores L3 chain configurations:
- `id`: Unique configuration ID
- `name`: Chain name
- `chain_id`: Blockchain chain ID
- `parent_chain`: Parent chain (arbitrum-one, arbitrum-sepolia, etc.)
- `validators`: Array of validator addresses (JSONB)
- `owner_address`: Chain owner address
- `sequencer_address`: Sequencer address
- `status`: draft | deploying | deployed | failed

### orbit_deployments Table
Tracks deployment status:
- `id`: Unique deployment ID
- `config_id`: Reference to configuration
- `status`: pending | completed | failed
- `logs`: Deployment progress logs (JSONB)
- `transaction_hash`: Deployment transaction hash
- `chain_address`: Deployed chain contract address
- `rpc_url`: L3 chain RPC endpoint

## 🚀 Getting Started

### 1. Database Setup

Run the SQL migration to create the required tables:

```bash
psql -U your_user -d your_database -f frontend/migrations/orbit_builder_schema.sql
```

### 2. Backend Setup

The backend is already configured in `backend/app.js`. Just make sure your backend is running:

```bash
cd backend
npm install
npm start
```

The backend should be running on `http://localhost:3002`

### 3. Frontend Setup

The frontend should already have the Orbit Builder integrated. Start the development server:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000/orbit-builder`

### 4. Create Your First L3 Configuration

1. Navigate to **Orbit Builder** from the main menu
2. Fill in the configuration form:
   - **Chain Name**: Give your L3 a unique name
   - **Chain ID**: Choose a unique chain ID (1-4,294,967,295)
   - **Parent Chain**: Select where to deploy (Arbitrum Sepolia for testing)
   - **Owner Address**: Your wallet address that will control the chain
   - **Sequencer Address**: Address that will sequence transactions
   - **Validators**: Add at least one validator address
3. Click **Save Configuration**
4. Click **Deploy L3 Chain** to start deployment

### 5. Monitor Deployment

Switch to the **My Deployments** tab to:
- View real-time deployment progress
- See deployment logs
- Get RPC URL and explorer links once deployed

## 🔐 Configuration Parameters

### Required Parameters
- **name**: Chain name
- **chainId**: Unique chain ID (integer)
- **parentChain**: Parent L2 chain
- **ownerAddress**: Chain owner address
- **sequencerAddress**: Sequencer address
- **validators**: At least one validator address

### Optional Parameters
- **description**: Chain description
- **nativeToken**: Custom native token (default: ETH)
- **dataAvailability**: anytrust (lower cost) or rollup (higher security)
- **challengePeriod**: Time in seconds for challenge period (default: 7 days)
- **stakeToken**: Token used for staking
- **l2GasPrice**: L2 gas price in Gwei
- **l1GasPrice**: L1 gas price in Gwei
- **batchPosterAddress**: Batch poster address

## 📊 Parent Chain Options

- **arbitrum-one**: Arbitrum One mainnet
- **arbitrum-sepolia**: Arbitrum Sepolia testnet (recommended for testing)
- **arbitrum-goerli**: Arbitrum Goerli testnet
- **ethereum**: Ethereum mainnet

## 🎯 Use Cases

1. **Gaming**: Create a dedicated L3 for gaming applications with custom gas tokens
2. **DeFi**: Build high-throughput DeFi protocols with lower transaction costs
3. **NFT Platforms**: Deploy NFT marketplaces with optimized fees
4. **Enterprise**: Create private/permissioned chains for enterprise use
5. **dApps**: Any dApp requiring high TPS and low fees

## 🔄 Deployment Flow

```
1. User creates configuration → Saved to database
2. User clicks deploy → Deployment initiated
3. Backend validates config → Check parameters
4. Deploy core contracts → Orbit contracts deployed
5. Configure validators → Set up validation
6. Setup sequencer → Initialize sequencer
7. Initialize chain → Genesis state setup
8. Deployment complete → Return RPC + Explorer URLs
```

## 🛠️ Future Enhancements

### Phase 2 (Planned)
- [ ] Integration with real Arbitrum Orbit SDK
- [ ] User authentication and config ownership
- [ ] Deployment cost estimation
- [ ] Multi-signature deployment support
- [ ] Chain monitoring dashboard
- [ ] Automatic validator setup
- [ ] Custom gas token integration
- [ ] Chain upgrade management

### Phase 3 (Future)
- [ ] Templates for common use cases
- [ ] One-click clone existing chains
- [ ] Analytics and metrics
- [ ] Governance module
- [ ] Bridge deployment automation
- [ ] Token faucet integration

## ⚠️ Important Notes

1. **Testnet First**: Always test on Arbitrum Sepolia before mainnet
2. **Gas Costs**: Deploying an L3 requires ETH for gas fees
3. **Validator Setup**: Validators need to run validator nodes
4. **Sequencer**: Sequencer needs infrastructure to process transactions
5. **Security**: Keep private keys secure and use hardware wallets

## 🐛 Troubleshooting

### Backend not starting
```bash
# Check if port 3002 is already in use
lsof -i :3002

# Kill the process if needed
kill -9 <PID>
```

### Frontend build errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database connection issues
```bash
# Check PostgreSQL is running
pg_isready

# Verify database credentials in .env
```

## 📚 Resources

- [Arbitrum Orbit Documentation](https://docs.arbitrum.io/launch-orbit-chain/orbit-gentle-introduction)
- [Arbitrum Orbit SDK](https://github.com/OffchainLabs/arbitrum-orbit-sdk)
- [Arbitrum Developer Docs](https://docs.arbitrum.io/)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This feature is part of the BlockOps project.

---

**Built with ❤️ using Arbitrum Orbit**
