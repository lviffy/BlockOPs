"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Bot, MessageCircle, Plus, LogOut, Loader2, MoreVertical, Download, Copy, Check, FileCode, Layers } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { getAgentsByUserId, deleteAgent } from "@/lib/agents"
import type { Agent } from "@/lib/supabase"
import { AgentWalletModal } from "@/components/agent-wallet"
import { UserProfile } from "@/components/user-profile"
import { PrivateKeySetupModal } from "@/components/private-key-setup-modal"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function MyAgents() {
  const router = useRouter()
  const { ready, authenticated, user, logout, loading: authLoading, isWalletLogin, showPrivateKeySetup, setShowPrivateKeySetup, syncUser } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [selectedAgentForExport, setSelectedAgentForExport] = useState<Agent | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/")
    }
  }, [ready, authenticated, router])

  useEffect(() => {
    if (ready && authenticated && user?.id) {
      fetchAgents()
    }
  }, [ready, authenticated, user])

  const fetchAgents = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const userAgents = await getAgentsByUserId(user.id)
      setAgents(userAgents)
    } catch (error) {
      console.error("Error fetching agents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    setAgentToDelete(agentId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!agentToDelete) return
    try {
      await deleteAgent(agentToDelete)
      setAgents(agents.filter((agent) => agent.id !== agentToDelete))
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
    } catch (error) {
      console.error("Error deleting agent:", error)
    }
  }

  const handleAgentClick = (agentId: string) => {
    router.push(`/agent-builder?agent=${agentId}`)
  }

  if (!ready || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-foreground mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </main>
    )
  }

  if (!authenticated) {
    return null // Will redirect
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 lg:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              <span className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">My Agents</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage and interact with your BlockOps agents
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button asChild size="lg" variant="outline" className="font-semibold border-2 hover:bg-accent/50 transition-all shadow-sm">
              <Link href="/orbit-builder">
                <Layers className="h-5 w-5 mr-2" />
                Orbit L3 Builder
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-semibold border-2 hover:bg-accent/50 transition-all shadow-sm">
              <Link href="/contract-explorer">
                <FileCode className="h-5 w-5 mr-2" />
                Contract Explorer
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-lg hover:shadow-xl transition-all">
              <Link href="/agent-builder">
                <Plus className="h-5 w-5 mr-2" />
                Create New Agent
              </Link>
            </Button>
            <AgentWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} hideButton={isWalletLogin} />
            <UserProfile onLogout={logout} />
          </div>
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="group transition-all duration-200 hover:shadow-xl hover:shadow-foreground/5 hover:border-foreground/30 hover:-translate-y-1"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10 group-hover:bg-foreground/20 transition-colors shrink-0">
                        <Bot className="h-6 w-6 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAgentClick(agent.id)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAgent(agent.id)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="mt-2 line-clamp-2">
                    {agent.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                    {agent.tools.length} tool(s) configured
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4 flex gap-2">
                        <Button
                          variant="default"
                          className="flex-1 font-semibold"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/agent/${agent.id}/chat`)
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
                  <Button
                    variant="outline"
                    className="flex-1 font-semibold"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedAgentForExport(agent)
                      setExportDialogOpen(true)
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-center">
            <div className="bg-muted/50 p-8 rounded-full mb-6">
              <Bot className="h-20 w-20 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-3">No agents yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md text-sm sm:text-base">
              Create your first BlockOps agent to get started with workflow automation
            </p>
            <Button asChild size="lg" className="shadow-lg font-semibold">
              <Link href="/agent-builder">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Agent
              </Link>
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-foreground text-background hover:bg-foreground/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-[95vw]! w-[95vw]! max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader>
            <DialogTitle>Export Agent: {selectedAgentForExport?.name}</DialogTitle>
            <DialogDescription>
              Use this agent in your code with the API key below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">API Key</label>
              <div className="relative p-3 bg-muted rounded-md border">
                <code className="text-sm font-mono break-all pr-10">{selectedAgentForExport?.api_key}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => {
                    if (selectedAgentForExport?.api_key) {
                      navigator.clipboard.writeText(selectedAgentForExport.api_key)
                      setCopiedItem("api_key")
                      setTimeout(() => setCopiedItem(null), 2000)
                      toast({
                        title: "Copied",
                        description: "API key copied to clipboard",
                      })
                    }
                  }}
                >
                  {copiedItem === "api_key" ? (
                    <Check className="h-3 w-3 text-foreground" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">How to Use</label>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Make a POST request to <code className="bg-muted px-1 py-0.5 rounded">http://localhost:8000/agent/chat</code> with the following body:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="bg-muted px-1 py-0.5 rounded">tools</code>: Array of tools configured for this agent</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">user_message</code>: The message you want to send to the agent</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">private_key</code>: (Optional) Your wallet private key for blockchain operations</li>
                </ul>
              </div>
            </div>

            {/* API Documentation */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">API Documentation</label>
              <div className="space-y-4 text-sm">
                {/* Agent Configuration */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">Agent Configuration</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    This agent has {selectedAgentForExport?.tools?.length || 0} tool(s) configured. 
                    When calling the API, you need to include the complete tools array that defines what operations 
                    your agent can perform. The tools are stored in your agent configuration.
                  </p>
                </div>

                {/* How to Use */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">How to Use</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">1.</span>
                      <span><strong>Get agent tools</strong> from your agent configuration (see examples below)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">2.</span>
                      <span><strong>Include tools array</strong> in your request body</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">3.</span>
                      <span><strong>Send POST requests</strong> to <code className="bg-muted px-1 py-0.5 rounded">http://localhost:8000/agent/chat</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">4.</span>
                      <span><strong>Receive responses</strong> with agent replies and tool execution results</span>
                    </li>
                  </ul>
                </div>

                {/* Security Best Practices */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">Security Best Practices</h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">•</span>
                      <span><strong>Never expose</strong> your API key in client-side code or public repositories</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">•</span>
                      <span><strong>Store securely</strong> in environment variables or secure vaults</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">•</span>
                      <span><strong>Don't share</strong> your API key publicly or commit it to version control</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold shrink-0">•</span>
                      <span><strong>Rotate regularly</strong> by deleting and recreating your agent if compromised</span>
                    </li>
                  </ul>
                </div>

                {/* Request Parameters */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">Request Parameters</h4>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="border-b border-border pb-2">
                      <code className="bg-muted px-2 py-1 rounded font-semibold">tools</code>
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">required</span>
                      <p className="mt-1 text-xs">Array of tool objects with tool name and next_tool (array)</p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <code className="bg-muted px-2 py-1 rounded font-semibold">user_message</code>
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">required</span>
                      <p className="mt-1 text-xs">The message/instruction you want to send to the agent (string)</p>
                    </div>
                    <div>
                      <code className="bg-muted px-2 py-1 rounded font-semibold">private_key</code>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">optional</span>
                      <p className="mt-1 text-xs">Your wallet private key for blockchain operations (string)</p>
                    </div>
                  </div>
                </div>

                {/* Response Structure */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">Response Structure</h4>
                  <div className="space-y-2 text-muted-foreground text-xs">
                    <div>
                      <code className="bg-muted px-2 py-1 rounded font-semibold">agent_response</code>
                      <p className="mt-1">The agent's natural language response to your message</p>
                    </div>
                    <div>
                      <code className="bg-muted px-2 py-1 rounded font-semibold">tool_calls</code>
                      <p className="mt-1">Array of tools the agent called during execution</p>
                    </div>
                    <div>
                      <code className="bg-muted px-2 py-1 rounded font-semibold">results</code>
                      <p className="mt-1">Array of results from each tool execution</p>
                    </div>
                  </div>
                </div>

                {/* Rate Limits & Usage */}
                <div className="p-3 bg-muted border rounded-md">
                  <h4 className="font-semibold mb-2">Rate Limits & Usage</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Each API key is unique to your agent. Monitor your usage through the agent dashboard. 
                    For high-volume applications, consider implementing client-side rate limiting and error handling 
                    to ensure reliable operation.
                  </p>
                </div>
              </div>
            </div>

            {/* cURL Example */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">cURL Example</label>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-md border overflow-x-auto text-xs">
                  <code>{`curl -X POST http://localhost:8000/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "tools": ${JSON.stringify(selectedAgentForExport?.tools || [{tool: "deploy_erc20", next_tool: null}], null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n')},
    "user_message": "Deploy a token called MyToken",
    "private_key": "YOUR_PRIVATE_KEY"
  }'`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const curlCommand = `curl -X POST http://localhost:8000/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "tools": ${JSON.stringify(selectedAgentForExport?.tools || [{tool: "deploy_erc20", next_tool: null}])},
    "user_message": "Deploy a token called MyToken",
    "private_key": "YOUR_PRIVATE_KEY"
  }'`
                    navigator.clipboard.writeText(curlCommand)
                    setCopiedItem("curl")
                    setTimeout(() => setCopiedItem(null), 2000)
                    toast({
                      title: "Copied",
                      description: "cURL command copied to clipboard",
                    })
                  }}
                >
                  {copiedItem === "curl" ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-foreground" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* JavaScript Example */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">JavaScript Example</label>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-md border overflow-x-auto text-xs">
                  <code>{`const response = await fetch('http://localhost:8000/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tools: ${JSON.stringify(selectedAgentForExport?.tools || [{tool: "deploy_erc20", next_tool: null}])},
    user_message: 'Deploy a token called MyToken',
    private_key: 'YOUR_PRIVATE_KEY'
  })
});

const data = await response.json();
console.log(data);`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const jsCode = `const response = await fetch('http://localhost:8000/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tools: ${JSON.stringify(selectedAgentForExport?.tools || [{tool: "deploy_erc20", next_tool: null}])},
    user_message: 'Deploy a token called MyToken',
    private_key: 'YOUR_PRIVATE_KEY'
  })
});

const data = await response.json();
console.log(data);`
                    navigator.clipboard.writeText(jsCode)
                    setCopiedItem("javascript")
                    setTimeout(() => setCopiedItem(null), 2000)
                    toast({
                      title: "Copied",
                      description: "JavaScript code copied to clipboard",
                    })
                  }}
                >
                  {copiedItem === "javascript" ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-foreground" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Response Format */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Response Format</label>
              <div className="p-3 bg-muted rounded-md border">
                <pre className="text-xs overflow-x-auto">
                  <code>{`{
  "agent_response": "The agent's response text...",
  "tool_calls": [
    {
      "tool": "tool_name",
      "parameters": { ... }
    }
  ],
  "results": [
    {
      "success": true,
      "tool": "tool_name",
      "result": { ... }
    }
  ]
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Private Key Setup Modal */}
      {authenticated && user && (
        <PrivateKeySetupModal
          open={showPrivateKeySetup}
          onOpenChange={setShowPrivateKeySetup}
          userId={user.id}
          onComplete={syncUser}
        />
      )}
    </main>
  )
}

