const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  Warning: GROQ_API_KEY not set in .env');
}

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  Warning: GEMINI_API_KEY not set in .env');
}

const groq = process.env.GROQ_API_KEY 
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Chat with AI using Groq
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Model to use
 * @param {Object} options - Additional options
 * @returns {Promise<string>} AI response
 */
async function chatWithAI(messages, model = 'moonshotai/kimi-k2-instruct-0905', options = {}) {
  // Try Groq first
  if (groq) {
    try {
      const { maxTokens, temperature, topP, ...restOptions } = options;
      
      const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 1024,
        top_p: topP || 1,
        stream: false,
        ...restOptions
      });

      return completion.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('Groq API error:', error.message);
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate_limit') || error.message?.includes('429')) {
        console.log('⚠️  Groq rate limit exceeded, falling back to Gemini...');
        
        // Fallback to Gemini
        if (genAI) {
          return await chatWithGemini(messages, options);
        } else {
          throw new Error('Rate limit exceeded and Gemini not configured. Please try again later.');
        }
      } else if (error.message?.includes('invalid_api_key')) {
        throw new Error('Invalid Groq API key. Please check your configuration.');
      } else {
        // For other errors, try Gemini fallback
        if (genAI) {
          console.log('⚠️  Groq error, falling back to Gemini...');
          return await chatWithGemini(messages, options);
        }
        throw new Error(`AI service error: ${error.message}`);
      }
    }
  }
  
  // If Groq not configured, try Gemini
  if (genAI) {
    console.log('ℹ️  Using Gemini (Groq not configured)');
    return await chatWithGemini(messages, options);
  }
  
  throw new Error('No AI provider configured. Please set GROQ_API_KEY or GEMINI_API_KEY in .env');
}

/**
 * Chat with Gemini AI (fallback)
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options
 * @returns {Promise<string>} AI response
 */
async function chatWithGemini(messages, options = {}) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 1024,
      }
    });

    // Convert messages to Gemini format
    const geminiMessages = messages.filter(m => m.role !== 'system');
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    
    // Build conversation history
    const history = geminiMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const chat = model.startChat({ history });
    
    const prompt = systemPrompt 
      ? `${systemPrompt}\n\n${lastMessage.content}`
      : lastMessage.content;
    
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw new Error(`Gemini service error: ${error.message}`);
  }
}

/**
 * Get available models
 * @returns {Array} Available model names
 */
function getAvailableModels() {
  return [
    'llama-3.1-70b-versatile',  // Fast, high quality (recommended)
    'llama-3.1-8b-instant',     // Fastest, lightweight
    'llama3-70b-8192',          // High quality
    'llama3-8b-8192',           // Balanced
    'gemma2-9b-it'              // Lightweight alternative
  ];
}

module.exports = { 
  chatWithAI,
  chatWithGemini,
  getAvailableModels
};
