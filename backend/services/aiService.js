const Groq = require('groq-sdk');
require('dotenv').config();

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  Warning: GROQ_API_KEY not set in .env');
}

const groq = process.env.GROQ_API_KEY 
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

/**
 * Chat with AI using Groq
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Model to use
 * @param {Object} options - Additional options
 * @returns {Promise<string>} AI response
 */
async function chatWithAI(messages, model = 'llama-3.1-8b-instant', options = {}) {
  if (!groq) {
    throw new Error('Groq API not configured. Please set GROQ_API_KEY in .env');
  }

  try {
    // Destructure to remove properties we handle explicitly
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
    
    // Provide helpful error messages
    if (error.message?.includes('rate_limit')) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    } else if (error.message?.includes('invalid_api_key')) {
      throw new Error('Invalid Groq API key. Please check your configuration.');
    } else {
      throw new Error(`AI service error: ${error.message}`);
    }
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
  getAvailableModels
};
