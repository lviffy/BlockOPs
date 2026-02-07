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
        self.groq_client: Optional[Groq] = None
        self.gemini_model = None
        
        # Initialize Groq
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            self.groq_client = Groq(api_key=groq_key)
            logger.info("Groq client initialized")
        else:
            logger.warning("GROQ_API_KEY not set")
        
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
        
        # Add context hint for current step
        step_question = get_step_question(current_step, collected_params)
        messages.append({
            "role": "system",
            "content": f"Context: You should be asking about '{current_step}'. The default question is: {step_question}",
        })
        
        # Try Groq first
        if self.groq_client:
            try:
                response = await self._call_groq(messages)
                if response:
                    return response
            except Exception as e:
                logger.error(f"Groq error: {e}")
        
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
    
    async def _call_groq(self, messages: list[dict]) -> Optional[str]:
        """Call Groq API."""
        if not self.groq_client:
            return None
        
        # Groq uses synchronous API, wrap it
        import asyncio
        
        def call():
            response = self.groq_client.chat.completions.create(
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
