const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../config/constants');

// Initialize Gemini client
let geminiClient = null;
if (GEMINI_API_KEY) {
  geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// System prompt for fetching token prices from natural language
const PRICE_SYSTEM_PROMPT = `You are a cryptocurrency price data assistant. Your task is to understand natural language queries about cryptocurrency prices and fetch the current prices from the web.

INSTRUCTIONS:
1. Parse the user's natural language query to identify which cryptocurrencies they want prices for
2. Understand queries like:
   - "bitcoin price" → BTC
   - "what's ethereum worth" → ETH
   - "show me solana and cardano prices" → SOL, ADA
   - "how much is dogecoin" → DOGE
   - "prices for BTC, ETH, and BNB" → BTC, ETH, BNB
   - "bitcoin ethereum solana" → BTC, ETH, SOL
3. Search for the CURRENT/LIVE price of each identified token
4. Return prices in USD
5. Provide the price information in a clear and structured format
6. Include price, 24h change percentage if available, and data source for each token
7. Use reliable sources like CoinMarketCap, CoinGecko, or Binance

Be accurate, understand the query intent, and use the most current prices available from authoritative sources.`;

/**
 * Token price endpoint - fetch current token prices using natural language queries
 * Uses Google Gemini AI with web search capability
 */
const getTokenPrice = async (req, res) => {
  try {
    const { query } = req.body;

    // Validation
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        usage: 'Provide a natural language query like "bitcoin price" or "show me ethereum and solana prices"'
      });
    }

    // Check if Gemini API key is configured
    if (!geminiClient) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key not configured',
        message: 'Please set GEMINI_API_KEY in your .env file'
      });
    }

    console.log('Fetching token prices for query:', query);

    // Use Gemini with grounding (web search)
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2, // Lower temperature for more factual responses
        topP: 0.8,
        topK: 40,
      },
    });

    // Enable Google Search grounding for real-time web data
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${PRICE_SYSTEM_PROMPT}\n\nUser Query: ${query}\n\nPlease search the web for current cryptocurrency prices and provide accurate, up-to-date information.`
            }
          ]
        }
      ],
      tools: [
        {
          googleSearch: {} // Enable Google Search grounding
        }
      ]
    });

    const response = await result.response;
    const priceInfo = response.text();

    // Extract grounding metadata if available
    let sources = [];
    if (response.candidates?.[0]?.groundingMetadata) {
      const groundingMetadata = response.candidates[0].groundingMetadata;
      if (groundingMetadata.groundingChunks) {
        sources = groundingMetadata.groundingChunks.map(chunk => ({
          title: chunk.web?.title || 'Web Source',
          url: chunk.web?.uri || '',
        }));
      }
    }

    return res.json({
      success: true,
      query: query,
      priceInfo: priceInfo,
      sources: sources.length > 0 ? sources : undefined,
      model: 'gemini-2.0-flash-exp',
      note: 'Prices are fetched in real-time from the web using Google Gemini with Google Search grounding'
    });

  } catch (error) {
    console.error('Token price error:', error);
    
    // Handle specific Gemini API errors
    let errorMessage = error.message;
    if (error.message?.includes('API key')) {
      errorMessage = 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env file';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Gemini API quota exceeded. Please try again later or upgrade your API plan';
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || error.code
    });
  }
};

module.exports = {
  getTokenPrice
};
