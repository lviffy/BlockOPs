"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Bot,
  MessageCircle,
  Plus,
  Loader2,
  MoreVertical,
  Download,
  Copy,
  Check,
  FileCode,
  Layers,
  Pencil,
  Trash2,
  ArrowRight,
  Wrench,
  Terminal,
  Code2,
} from "lucide-react"
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
  DropdownMenuSeparator,
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(label)
    setTimeout(() => setCopiedItem(null), 2000)
    toast({ title: "Copied", description: `${label} copied to clipboard` })
  }

  if (!ready || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-foreground" />
      </main>
    )
  }

  if (!authenticated) {
    return null
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-6 py-10">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                My Agents
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Build, manage, and interact with your blockchain agents.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AgentWalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} hideButton={isWalletLogin} />
              <UserProfile onLogout={logout} />
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
              <Link href="/orbit-builder">
                <Layers className="mr-1.5 h-3.5 w-3.5" />
                Orbit L3 Builder
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
              <Link href="/contract-explorer">
                <FileCode className="mr-1.5 h-3.5 w-3.5" />
                Contract Explorer
              </Link>
            </Button>
            <div className="flex-1" />
            <Button asChild size="sm" className="h-8 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium">
              <Link href="/agent-builder">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create Agent
              </Link>
            </Button>
          </div>

          <Separator className="my-6" />

          {/* Agent List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length > 0 ? (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-3.5 transition-colors hover:bg-muted/40 cursor-pointer"
                  onClick={() => router.push(`/agent/${agent.id}/chat`)}
                >
                  {/* Icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                    <Bot className="h-4 w-4 text-foreground/70" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {agent.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-4 shrink-0">
                        {agent.tools.length} {agent.tools.length === 1 ? "tool" : "tools"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {agent.description || "No description"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/agent/${agent.id}/chat`)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Chat</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedAgentForExport(agent)
                            setExportDialogOpen(true)
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Export</p></TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => handleAgentClick(agent.id)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Always-visible chat button on mobile */}
                  <Button
                    size="sm"
                    className="h-8 shrink-0 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium sm:hidden"
                    onClick={() => router.push(`/agent/${agent.id}/chat`)}
                  >
                    Chat
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-foreground">No agents yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Create your first agent to start automating blockchain operations.
              </p>
              <Button asChild size="sm" className="mt-5 h-8 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium">
                <Link href="/agent-builder">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Agent
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base">Delete agent?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This action cannot be undone. The agent and its configuration will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Export — {selectedAgentForExport?.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Integrate this agent into your application via the API.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  API Key
                </label>
                <div className="relative flex items-center rounded-md border border-border bg-muted/30 px-3 py-2.5">
                  <code className="text-xs font-mono text-foreground break-all pr-8">
                    {selectedAgentForExport?.api_key}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => selectedAgentForExport?.api_key && copyToClipboard(selectedAgentForExport.api_key, "API key")}
                  >
                    {copiedItem === "API key" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Endpoint */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono h-5 shrink-0">POST</Badge>
                  <code className="text-xs font-mono text-foreground">
                    http://localhost:8000/agent/chat
                  </code>
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Parameters
                </label>
                <div className="space-y-2">
                  {[
                    { name: "tools", required: true, desc: "Array of tool objects configured for this agent" },
                    { name: "user_message", required: true, desc: "Natural language instruction for the agent" },
                    { name: "private_key", required: false, desc: "Wallet private key for blockchain operations" },
                  ].map(({ name, required, desc }) => (
                    <div key={name} className="flex items-start gap-3 text-xs">
                      <code className="font-mono text-foreground shrink-0 pt-0.5">{name}</code>
                      <Badge
                        variant={required ? "default" : "secondary"}
                        className="text-[9px] h-4 px-1 shrink-0"
                      >
                        {required ? "required" : "optional"}
                      </Badge>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Code Examples */}
              <Tabs defaultValue="curl" className="w-full">
                <TabsList className="h-8 w-full bg-muted/50">
                  <TabsTrigger value="curl" className="text-xs h-6 gap-1.5 flex-1">
                    <Terminal className="h-3 w-3" />
                    cURL
                  </TabsTrigger>
                  <TabsTrigger value="js" className="text-xs h-6 gap-1.5 flex-1">
                    <Code2 className="h-3 w-3" />
                    JavaScript
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="curl" className="mt-3">
                  <div className="relative">
                    <pre className="rounded-md border border-border bg-muted/30 p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground">
{`curl -X POST http://localhost:8000/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "tools": ${JSON.stringify(selectedAgentForExport?.tools || [{ tool: "deploy_erc20", next_tool: null }], null, 2).split("\n").map((l, i) => (i === 0 ? l : "    " + l)).join("\n")},
    "user_message": "Deploy a token called MyToken",
    "private_key": "YOUR_PRIVATE_KEY"
  }'`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => {
                        const cmd = `curl -X POST http://localhost:8000/agent/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "tools": ${JSON.stringify(selectedAgentForExport?.tools || [{ tool: "deploy_erc20", next_tool: null }])},\n    "user_message": "Deploy a token called MyToken",\n    "private_key": "YOUR_PRIVATE_KEY"\n  }'`
                        copyToClipboard(cmd, "cURL")
                      }}
                    >
                      {copiedItem === "cURL" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="js" className="mt-3">
                  <div className="relative">
                    <pre className="rounded-md border border-border bg-muted/30 p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground">
{`const response = await fetch("http://localhost:8000/agent/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tools: ${JSON.stringify(selectedAgentForExport?.tools || [{ tool: "deploy_erc20", next_tool: null }])},
    user_message: "Deploy a token called MyToken",
    private_key: "YOUR_PRIVATE_KEY",
  }),
});

const data = await response.json();
console.log(data);`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => {
                        const js = `const response = await fetch("http://localhost:8000/agent/chat", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    tools: ${JSON.stringify(selectedAgentForExport?.tools || [{ tool: "deploy_erc20", next_tool: null }])},\n    user_message: "Deploy a token called MyToken",\n    private_key: "YOUR_PRIVATE_KEY",\n  }),\n});\n\nconst data = await response.json();\nconsole.log(data);`
                        copyToClipboard(js, "JavaScript")
                      }}
                    >
                      {copiedItem === "JavaScript" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Response */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Response
                </label>
                <pre className="rounded-md border border-border bg-muted/30 p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground">
{`{
  "agent_response": "string",
  "tool_calls": [{ "tool": "string", "parameters": {} }],
  "results": [{ "success": true, "tool": "string", "result": {} }]
}`}
                </pre>
              </div>

              {/* Security Note */}
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Security —</span>{" "}
                  Never expose your API key in client-side code. Store it in environment variables and rotate if compromised.
                </p>
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
    </TooltipProvider>
  )
}

