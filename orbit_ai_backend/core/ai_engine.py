"""
LLM orchestration with Groq (primary) and Gemini (fallback).
"""
import os
import logging
from typing import Optional

from groq import Groq
import google.generativeai as genai

from .prompts import get_system_prompt, get_step_question, FEW_SHOT_EXAMPLES

logger = logging.getLogger(__name__)


class AIEngine:
    """Manages LLM calls with fallback."""
    
    def __init__(self):
        self.groq_clients: list[Groq] = []
        self.gemini_model = None
        
        # Initialize all Groq API keys
        groq_keys = [
            os.getenv("GROQ_API_KEY1"),
            os.getenv("GROQ_API_KEY2"),
            os.getenv("GROQ_API_KEY3")
        ]
        
        for i, key in enumerate(groq_keys, 1):
            if key:
                self.groq_clients.append(Groq(api_key=key))
                logger.info(f"Groq client {i} initialized")
        
        if not self.groq_clients:
            logger.warning("No GROQ_API_KEY (1-3) configured")
        else:
            logger.info(f"Total {len(self.groq_clients)} Groq client(s) initialized")
        
        # Initialize Gemini
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel(
                model_name="gemini-2.0-flash-exp",
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 1000,
                },
            )
            logger.info("Gemini model initialized")
        else:
            logger.warning("GEMINI_API_KEY not set")
    
    async def generate_response(
        self,
        user_message: str,
        phase: str,
        current_step: str,
        collected_params: dict,
        message_history: list[dict],
    ) -> str:
        """Generate AI response using Groq with Gemini fallback."""
        
        system_prompt = get_system_prompt(phase, current_step, collected_params)
        
        # Build messages for LLM
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add few-shot examples
        for example in FEW_SHOT_EXAMPLES[:3]:  # Limit to 3 examples
            messages.append({"role": "user", "content": example["user"]})
            messages.append({"role": "assistant", "content": example["assistant"]})
        
        # Add conversation history (last 10 messages)
        for msg in message_history[-10:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })
        
        # Add current user message
        messages.append({"role": "user", "content": user_message})
        
        # Add context hint for current step with explicit param reminder
        step_question = get_step_question(current_step, collected_params)
        
        # Build explicit context about current values
        chain_name = collected_params.get("chain_name", "the chain")
        context_parts = [
            f"Context: You should be asking about '{current_step}'.",
            f"The user's chain is named: {chain_name}" if chain_name != "the chain" else "",
            f"Collected so far: {collected_params}",
            f"Default question hint: {step_question}",
            "CRITICAL: Use the actual chain name and values above, NEVER use example names like 'GameVerse'.",
        ]
        messages.append({
            "role": "system",
            "content": " ".join(filter(None, context_parts)),
        })
        
        # Try Groq first - cycle through all available keys
        if self.groq_clients:
            for i, client in enumerate(self.groq_clients, 1):
                try:
                    logger.info(f"Trying Groq client {i}/{len(self.groq_clients)}")
                    response = await self._call_groq(client, messages)
                    if response:
                        logger.info(f"Groq client {i} succeeded")
                        return response
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Groq client {i} error: {error_msg}")
                    
                    # Check if it's a rate limit error (429)
                    if "rate_limit" in error_msg.lower() or "429" in error_msg:
                        logger.warning(f"Groq client {i} rate limited (429)")
                        # Continue to next key
                        if i < len(self.groq_clients):
                            logger.info(f"Trying next Groq key...")
                            continue
                        else:
                            logger.warning("All Groq keys rate limited, falling back to Gemini")
                            break
                    else:
                        # For other errors, try next key if available
                        if i < len(self.groq_clients):
                            logger.info(f"Error with Groq client {i}, trying next key...")
                            continue
                        else:
                            logger.warning("All Groq clients failed")
                            break
        
        # Fallback to Gemini
        if self.gemini_model:
            try:
                response = await self._call_gemini(messages)
                if response:
                    return response
            except Exception as e:
                logger.error(f"Gemini error: {e}")
        
        # If both fail, return the default step question
        logger.warning("Both LLMs failed, using default question")
        return step_question
    
    async def _call_groq(self, client: Groq, messages: list[dict]) -> Optional[str]:
        """Call Groq API with a specific client."""
        if not client:
            return None
        
        # Groq uses synchronous API, wrap it
        import asyncio
        
        def call():
            response = client.chat.completions.create(
                model="moonshotai/kimi-k2-instruct-0905",
                messages=messages,
                temperature=0.7,
                max_tokens=800,
            )
            return response.choices[0].message.content
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, call)
    
    async def _call_gemini(self, messages: list[dict]) -> Optional[str]:
        """Call Gemini API."""
        if not self.gemini_model:
            return None
        
        # Convert messages to Gemini format (single prompt)
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"[System]: {content}")
            elif role == "assistant":
                prompt_parts.append(f"[Assistant]: {content}")
            else:
                prompt_parts.append(f"[User]: {content}")
        
        prompt = "\n\n".join(prompt_parts)
        prompt += "\n\n[Assistant]:"
        
        import asyncio
        
        def call():
            response = self.gemini_model.generate_content(prompt)
            return response.text
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, call)
    
    def get_greeting(self) -> str:
        """Get the initial greeting message."""
        return get_step_question("use_case")


# Singleton instance
_ai_engine: Optional[AIEngine] = None


def get_ai_engine() -> AIEngine:
    """Get or create the AI engine singleton."""
    global _ai_engine
    if _ai_engine is None:
        _ai_engine = AIEngine()
    return _ai_engine
