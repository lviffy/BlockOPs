"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, Wallet, AlertCircle, CheckCircle2, ExternalLink, MessageSquare, Send } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { ethers } from "ethers"
import { useAuth } from "@/lib/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any
  }
}

interface ContractFunction {
  name: string
  type: string
  stateMutability: string
  inputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
  outputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
}

interface ContractInteractionProps {
  onInteraction?: (address: string, functionName: string, params: any[]) => void
}

export function ContractInteraction({ onInteraction }: ContractInteractionProps) {
  const { dbUser, privyWalletAddress, isWalletLogin } = useAuth()
  const [contractAddress, setContractAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [contractABI, setContractABI] = useState<any[] | null>(null)
  const [showManualABI, setShowManualABI] = useState(false)
  const [manualABI, setManualABI] = useState("")
  const [functions, setFunctions] = useState<{
    read: ContractFunction[]
    write: ContractFunction[]
  }>({ read: [], write: [] })
  const [functionParams, setFunctionParams] = useState<Record<string, string[]>>({})
  const [executingFunction, setExecutingFunction] = useState<string | null>(null)
  const [functionResults, setFunctionResults] = useState<Record<string, any>>({})
  
  // AI Chat states
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)

  const isValidAddress = (address: string) => {
    return ethers.isAddress(address)
  }

  const fetchContractABI = async () => {
    if (!isValidAddress(contractAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid contract address",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setShowManualABI(false)
    setContractABI(null)
    setFunctions({ read: [], write: [] })
    
    console.log("=== Starting contract load for:", contractAddress)
    
    try {
      // Try to fetch ABI from Etherscan API
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
      )
      
      console.log("Checking if contract exists on chain...")
      const code = await provider.getCode(contractAddress)
      console.log("Contract code length:", code.length)
      
      if (code === "0x") {
        toast({
          title: "Contract Not Found",
          description: "No contract found at this address on Ethereum Sepolia",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      console.log("Contract exists! Fetching ABI from Etherscan...")
      // Use Etherscan API V2 with chainid for Sepolia
      const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "YourApiKeyToken"
      // For Sepolia, use mainnet API endpoint with chainid=11155111
      const apiUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`
      console.log("API URL:", apiUrl)
      console.log("Using API Key:", apiKey.substring(0, 5) + "...")
      
      const response = await fetch(apiUrl)
      console.log("Response status:", response.status, response.statusText)
      
      const data = await response.json()
      console.log("Etherscan API V2 Response:", data)
      
      // V2 API response format
      if (data.status === "1" && data.result) {
        console.log("Result received, parsing ABI...")
        
        try {
          // V2 API returns result as string containing JSON array
          const abi = JSON.parse(data.result)
          console.log("ABI parsed successfully! Functions found:", abi.length)
          
          setContractABI(abi)
          parseFunctions(abi)
          toast({
            title: "Contract Loaded ✓",
            description: `Successfully loaded ${abi.length} contract functions`,
          })
        } catch (parseError) {
          console.error("Failed to parse ABI:", parseError)
          setShowManualABI(true)
          toast({
            title: "Error Parsing ABI",
            description: "The ABI format is invalid. Please paste it manually below.",
            variant: "destructive",
          })
        }
      } else {
        // If ABI not verified or other error
        console.log("Contract not verified or error. Full response:", data)
        setShowManualABI(true)
        
        let errorMessage = "Contract found but not verified on Etherscan."
        if (data.message && data.message !== "OK") {
          errorMessage = data.message
        }
        if (data.result && typeof data.result === "string" && !data.result.startsWith("[")) {
          errorMessage += ` ${data.result}`
        }
        
        toast({
          title: "Contract Not Verified",
          description: errorMessage + " Please paste ABI manually below.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error fetching contract:", error)
      toast({
        title: "Error Loading Contract",
        description: error.message || "Failed to fetch contract details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const parseFunctions = (abi: any[]) => {
    const readFunctions: ContractFunction[] = []
    const writeFunctions: ContractFunction[] = []

    console.log("Parsing ABI with", abi.length, "items")

    abi.forEach((item) => {
      if (item.type === "function") {
        const func: ContractFunction = {
          name: item.name,
          type: item.type,
          stateMutability: item.stateMutability,
          inputs: item.inputs || [],
          outputs: item.outputs || [],
        }

        if (item.stateMutability === "view" || item.stateMutability === "pure") {
          readFunctions.push(func)
        } else {
          writeFunctions.push(func)
        }
      }
    })

    console.log("Found functions:", { read: readFunctions.length, write: writeFunctions.length })
    setFunctions({ read: readFunctions, write: writeFunctions })
  }

  const handleManualABI = () => {
    try {
      const abi = JSON.parse(manualABI)
      setContractABI(abi)
      parseFunctions(abi)
      setShowManualABI(false)
      toast({
        title: "ABI Loaded",
        description: "Contract ABI loaded successfully from manual input",
      })
    } catch (error) {
      toast({
        title: "Invalid ABI",
        description: "Please enter a valid JSON ABI",
        variant: "destructive",
      })
    }
  }

  const handleParamChange = (functionName: string, index: number, value: string) => {
    setFunctionParams((prev) => {
      const params = [...(prev[functionName] || [])]
      params[index] = value
      return { ...prev, [functionName]: params }
    })
  }

  const executeReadFunction = async (func: ContractFunction) => {
    if (!contractABI) return

    setExecutingFunction(func.name)
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
      )
      const contract = new ethers.Contract(contractAddress, contractABI, provider)

      const params = functionParams[func.name] || []
      const result = await contract[func.name](...params)

      setFunctionResults((prev) => ({
        ...prev,
        [func.name]: { success: true, result: result.toString() },
      }))

      toast({
        title: "Function Executed",
        description: `${func.name} executed successfully`,
      })

      if (onInteraction) {
        onInteraction(contractAddress, func.name, params)
      }
    } catch (error: any) {
      console.error("Error executing function:", error)
      setFunctionResults((prev) => ({
        ...prev,
        [func.name]: { success: false, error: error.message },
      }))
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute function",
        variant: "destructive",
      })
    } finally {
      setExecutingFunction(null)
    }
  }

  const executeWriteFunction = async (func: ContractFunction) => {
    // Check if user has either agent wallet or Privy wallet
    const hasAgentWallet = dbUser?.private_key
    const hasPrivyWallet = isWalletLogin && privyWalletAddress
    
    if (!contractABI || (!hasAgentWallet && !hasPrivyWallet)) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to execute write functions",
        variant: "destructive",
      })
      return
    }

    setExecutingFunction(func.name)
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
      )
      
      let contract: ethers.Contract
      
      // Use agent wallet if available, otherwise use Privy wallet (browser provider)
      if (hasAgentWallet) {
        // Use agent wallet with private key
        const wallet = new ethers.Wallet(dbUser.private_key!, provider)
        contract = new ethers.Contract(contractAddress, contractABI, wallet)
      } else if (hasPrivyWallet) {
        // Use Privy wallet - requires browser provider
        const browserProvider = new ethers.BrowserProvider(window.ethereum)
        const signer = await browserProvider.getSigner()
        contract = new ethers.Contract(contractAddress, contractABI, signer)
      } else {
        throw new Error("No wallet available")
      }

      const params = functionParams[func.name] || []
      const tx = await contract[func.name](...params)
      
      toast({
        title: "Transaction Sent",
        description: "Waiting for confirmation...",
      })

      const receipt = await tx.wait()

      setFunctionResults((prev) => ({
        ...prev,
        [func.name]: { 
          success: true, 
          result: receipt.hash,
          txHash: receipt.hash 
        },
      }))

      toast({
        title: "Transaction Confirmed",
        description: `${func.name} executed successfully`,
      })

      if (onInteraction) {
        onInteraction(contractAddress, func.name, params)
      }
    } catch (error: any) {
      console.error("Error executing function:", error)
      setFunctionResults((prev) => ({
        ...prev,
        [func.name]: { success: false, error: error.message },
      }))
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to execute function",
        variant: "destructive",
      })
    } finally {
      setExecutingFunction(null)
    }
  }

  const handleAIChatSubmit = async () => {
    if (!chatInput.trim() || !contractABI) return

    const userMessage = chatInput.trim()
    setChatInput("")
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsChatLoading(true)

    try {
      // TODO: Replace with actual AI API call
      // For now, just echo back with function suggestions
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const response = `I understand you want to interact with the contract. Here are the available functions:\n\n` +
        `Read Functions: ${functions.read.map(f => f.name).join(', ')}\n\n` +
        `Write Functions: ${functions.write.map(f => f.name).join(', ')}\n\n` +
        `Please specify which function you'd like to call and with what parameters.`
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request.' 
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const renderFunctionCard = (func: ContractFunction, isWrite: boolean) => {
    const result = functionResults[func.name]
    const isExecuting = executingFunction === func.name
    const hasWallet = dbUser?.private_key || (isWalletLogin && privyWalletAddress)

    return (
      <AccordionItem key={func.name} value={func.name}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <span className="font-semibold">{func.name}</span>
            <Badge variant={isWrite ? "destructive" : "secondary"} className="text-xs">
              {isWrite ? "Write" : "Read"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {func.stateMutability}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            {func.inputs.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Input Parameters</Label>
                {func.inputs.map((input, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`${func.name}-${index}`} className="text-xs">
                      {input.name || `param${index}`} ({input.type})
                    </Label>
                    <Input
                      id={`${func.name}-${index}`}
                      placeholder={`Enter ${input.type}`}
                      value={functionParams[func.name]?.[index] || ""}
                      onChange={(e) => handleParamChange(func.name, index, e.target.value)}
                      disabled={isExecuting}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => isWrite ? executeWriteFunction(func) : executeReadFunction(func)}
              disabled={isExecuting || (isWrite && !hasWallet)}
              className="w-full"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>Execute {func.name}</>
              )}
            </Button>

            {isWrite && !hasWallet && (
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  Connect your wallet to execute write functions
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-1">
                      <div className="font-semibold">Result:</div>
                      <div className="break-all">{result.result}</div>
                      {result.txHash && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.etherscan.io"}/tx/${result.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:underline mt-2"
                        >
                          View on Explorer <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold">Error:</div>
                      <div className="break-all text-sm">{result.error}</div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {func.outputs.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold">Returns:</span>{" "}
                {func.outputs.map((output, idx) => (
                  <span key={idx}>
                    {output.name || `output${idx}`} ({output.type})
                    {idx < func.outputs.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contract Interaction</CardTitle>
          <CardDescription>
            Enter a contract address to view and interact with its functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="0x... (Contract Address)"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={fetchContractABI}
              disabled={isLoading || !contractAddress}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Load Contract
                </>
              )}
            </Button>
          </div>

          {showManualABI && (
            <div className="mt-4 space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Contract is not verified on Arbiscan. Please paste the contract ABI (JSON format) below.
                </AlertDescription>
              </Alert>
              <Label htmlFor="manual-abi">Contract ABI (JSON)</Label>
              <Textarea
                id="manual-abi"
                placeholder='[{"inputs":[],"name":"functionName","outputs":[],"stateMutability":"view","type":"function"}]'
                value={manualABI}
                onChange={(e) => setManualABI(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
              <Button onClick={handleManualABI} className="w-full">
                Load ABI
              </Button>
            </div>
          )}

          {(dbUser?.wallet_address || privyWalletAddress) && (
            <Alert className="mt-4">
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                <div className="text-base font-mono font-semibold break-all">
                  {dbUser?.wallet_address || privyWalletAddress}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Debug/Status Card */}
      {contractAddress && !contractABI && !showManualABI && !isLoading && (
        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Waiting for contract to load...</div>
                <div className="text-sm mt-1">
                  Check the console (F12) for debug information.
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {contractABI && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Functions Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Contract Functions</CardTitle>
                <CardDescription>
                  {functions.read.length + functions.write.length} functions found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="read" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="read">
                      Read Functions ({functions.read.length})
                    </TabsTrigger>
                    <TabsTrigger value="write">
                      Write Functions ({functions.write.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="read">
                    <ScrollArea className="h-[400px] pr-4">
                      {functions.read.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          {functions.read.map((func) => renderFunctionCard(func, false))}
                        </Accordion>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No read functions found
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="write">
                    <ScrollArea className="h-[400px] pr-4">
                      {functions.write.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          {functions.write.map((func) => renderFunctionCard(func, true))}
                        </Accordion>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No write functions found
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* AI Chat Panel */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask AI to help you interact with the contract
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 pr-4 mb-4 h-[300px]">
                  <div className="space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Ask me anything about this contract!</p>
                        <p className="mt-2 text-xs">
                          Examples:<br />
                          "What functions are available?"<br />
                          "How do I call the transfer function?"<br />
                          "What parameters does the function need?"
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-4 py-2 ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 pt-4 border-t">
                  <Input
                    placeholder="Ask AI about the contract..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAIChatSubmit()
                      }
                    }}
                    disabled={isChatLoading}
                  />
                  <Button
                    size="icon"
                    onClick={handleAIChatSubmit}
                    disabled={!chatInput.trim() || isChatLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
