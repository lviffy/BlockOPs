# BlockOps - FrontendThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).



This is the frontend application for BlockOps, built with [Next.js](https://nextjs.org).## Getting Started



## FeaturesFirst, run the development server:



- 🎨 **Visual Drag & Drop Workflow Builder** - Create blockchain automation workflows with an intuitive visual interface```bash

- 🤖 **AI-Powered Agent Generation** - Generate agents using AI based on your requirementsnpm run dev

- 🔗 **Blockchain Integration** - Interact with BlockOps testnet smart contracts# or

- 🛠️ **10+ Blockchain Tools** - Token transfers, swaps, NFT/Token deployment, DAO creation, airdrops, and moreyarn dev

- 💼 **Wallet Management** - Create agent wallets or import existing ones# or

- 📊 **Real-time Updates** - See your workflows execute in real-timepnpm dev

# or

## Getting Startedbun dev

```

### Prerequisites

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

- Node.js 18+ 

- npm, yarn, pnpm, or bunYou can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.



### InstallationThis project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.



1. Install dependencies:## Learn More



```bashTo learn more about Next.js, take a look at the following resources:

npm install

# or- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

yarn install- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

# or

pnpm installYou can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

```

## Deploy on Vercel

2. Run the development server:

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

```bash

npm run devCheck out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# or
yarn dev
# or
pnpm dev
# or
bun dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Key Components

- **Workflow Builder** (`components/workflow-builder.tsx`) - Main drag & drop interface
- **Node Library** (`components/node-library.tsx`) - Available blockchain tools
- **Agent Nodes** (`components/nodes/`) - Individual tool components
- **AI Chat Modal** (`components/ai-chat-modal.tsx`) - AI-powered agent generation

## Project Structure

```
frontend/
├── app/                 # Next.js app directory
│   ├── agent-builder/   # Agent builder page
│   ├── my-agents/       # User's agents page
│   └── api/            # API routes (empty - backend removed)
├── components/         # React components
│   ├── nodes/         # Custom node components
│   └── ui/            # UI components
├── lib/               # Utility functions and types
└── hooks/             # Custom React hooks
```

## Technologies Used

- **Next.js 14+** - React framework
- **TypeScript** - Type safety
- **React Flow** - Workflow visualization and drag & drop
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Supabase** - Authentication and data storage
- **ethers.js** - Blockchain interaction

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Flow Documentation](https://reactflow.dev)
- [BlockOps Network](https://somnia.network)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
