import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const { userQuery, userId } = await request.json()

    if (!userQuery) {
      return NextResponse.json(
        { success: false, message: 'User query is required' },
        { status: 400 }
      )
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    })

    const prompt = `You are an Arbitrum Orbit L3 configuration expert. Parse the user's requirements and generate a complete L3 chain configuration.

User Request: "${userQuery}"

Analyze the request and extract/infer:
1. Chain name (from context or suggest one)
2. Chain ID (generate a unique number like 412346-412999 for L3s)
3. Parent chain (default: "arbitrum-sepolia" for testnet, "arbitrum-one" for production)
4. Owner address (if not provided, use: "0x0000000000000000000000000000000000000000")
5. Validators (if specified, otherwise create 3 validator addresses starting with 0x1111..., 0x2222..., 0x3333...)
6. Chain configuration:
   - chainName: user-specified or inferred from chain name
   - nativeToken: {name, symbol, decimals} - default to "Ether", "ETH", 18 unless specified
   - sequencerUrl: generate as https://sequencer-{chainname}.example.com
   - blockTime: infer from requirements (gaming=1s, defi=2s, enterprise=3s, default=2s)
   - gasLimit: infer from requirements (high-throughput=50000000, normal=30000000, default=30000000)

Important rules:
1. If user mentions "gaming" or "fast", set blockTime to 1 second
2. If user mentions "DeFi" or "finance", set blockTime to 2 seconds  
3. If user mentions "enterprise" or "private", set blockTime to 3 seconds
4. If user specifies number of validators, generate that many addresses
5. Generate realistic placeholder validator addresses (0x1111...1111, 0x2222...2222, etc.)
6. Chain IDs for L3s should be in range 412346-412999
7. Make the chain name URL-friendly (lowercase, no spaces)

Respond ONLY with a JSON object in this EXACT format (no other text):
{
  "name": "chain-name",
  "chainId": "412xxx",
  "parentChain": "arbitrum-sepolia",
  "owner": "0x0000000000000000000000000000000000000000",
  "validators": ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"],
  "chainConfig": {
    "chainName": "Readable Chain Name",
    "nativeToken": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "sequencerUrl": "https://sequencer-chainname.example.com",
    "blockTime": 2,
    "gasLimit": 30000000
  }
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const aiText = response.text()

    console.log('AI Response:', aiText)

    // Parse JSON from response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        success: false,
        message: "I couldn't understand your requirements. Could you provide more details about your L3 chain?"
      })
    }

    const config = JSON.parse(jsonMatch[0])

    // Validate the config has required fields
    if (!config.name || !config.chainId || !config.parentChain) {
      return NextResponse.json({
        success: false,
        message: "I couldn't generate a complete configuration. Please try rephrasing your request."
      })
    }

    return NextResponse.json({
      success: true,
      config,
      message: `I've created a configuration for "${config.chainConfig?.chainName || config.name}"!

Here's what I've set up:
• Chain ID: ${config.chainId}
• Parent Chain: ${config.parentChain}
• Validators: ${config.validators?.length || 0}
• Native Token: ${config.chainConfig?.nativeToken?.name || 'ETH'} (${config.chainConfig?.nativeToken?.symbol || 'ETH'})
• Block Time: ${config.chainConfig?.blockTime || 2} seconds
• Gas Limit: ${(config.chainConfig?.gasLimit || 30000000).toLocaleString()}

Click "Apply Configuration" to use these settings!`
    })

  } catch (error: any) {
    console.error('AI Parse Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to generate configuration'
      },
      { status: 500 }
    )
  }
}
