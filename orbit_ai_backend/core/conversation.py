"""
Conversation state machine and session management.
"""
import uuid
import time
import logging
from datetime import datetime
from typing import Optional

from models.conversation import (
    ConversationSession,
    ConversationPhase,
    ConfigStep,
    Message,
    CONFIG_STEP_ORDER,
)
from utils.validators import (
    parse_use_case_from_text,
    parse_validator_count_from_text,
    parse_block_time_from_text,
    extract_chain_name_from_text,
    extract_wallet_intent,
    is_valid_eth_address,
    normalize_eth_address,
    generate_chain_id,
)
from utils.defaults import get_preset, generate_validators, get_default_value
from .ai_engine import get_ai_engine
from .prompts import get_step_question

logger = logging.getLogger(__name__)


class ConversationManager:
    """Manages conversation sessions with TTL expiration."""
    
    def __init__(self, ttl_seconds: int = 7200):
        self.sessions: dict[str, ConversationSession] = {}
        self.session_timestamps: dict[str, float] = {}
        self.ttl_seconds = ttl_seconds
    
    def create_session(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        wallet_address: Optional[str] = None,
    ) -> ConversationSession:
        """Create a new conversation session."""
        self._cleanup_expired()
        
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        # If session exists, return it
        if session_id in self.sessions:
            return self.sessions[session_id]
        
        session = ConversationSession(
            session_id=session_id,
            user_id=user_id,
            wallet_address=wallet_address,
        )
        
        # Add greeting message
        greeting = get_ai_engine().get_greeting()
        session.messages.append(Message(
            id=str(uuid.uuid4()),
            role="assistant",
            content=greeting,
        ))
        
        self.sessions[session_id] = session
        self.session_timestamps[session_id] = time.time()
        
        return session
    
    def get_session(self, session_id: str) -> Optional[ConversationSession]:
        """Get an existing session by ID."""
        self._cleanup_expired()
        
        if session_id in self.sessions:
            self.session_timestamps[session_id] = time.time()  # Touch
            return self.sessions[session_id]
        
        return None
    
    def reset_session(self, session_id: str) -> ConversationSession:
        """Reset a session to start over."""
        if session_id in self.sessions:
            old = self.sessions[session_id]
            del self.sessions[session_id]
            return self.create_session(
                session_id=session_id,
                user_id=old.user_id,
                wallet_address=old.wallet_address,
            )
        return self.create_session(session_id=session_id)
    
    async def process_message(
        self,
        session_id: str,
        user_message: str,
        wallet_address: Optional[str] = None,
    ) -> ConversationSession:
        """Process a user message and generate AI response."""
        session = self.get_session(session_id)
        if not session:
            session = self.create_session(session_id, wallet_address=wallet_address)
        
        # Update wallet if provided
        if wallet_address:
            session.wallet_address = wallet_address
        
        # Add user message
        session.messages.append(Message(
            id=str(uuid.uuid4()),
            role="user",
            content=user_message,
        ))
        
        # Check for commands
        lower_msg = user_message.lower().strip()
        
        # Go back command
        if lower_msg in ["go back", "back", "previous", "undo"]:
            if session.go_back_step():
                ai_response = f"No problem! Let's go back.\n\n{get_step_question(session.current_step.value, session.collected_params)}"
            else:
                ai_response = "We're already at the first step. Let's continue from here."
            
            session.messages.append(Message(
                id=str(uuid.uuid4()),
                role="assistant",
                content=ai_response,
            ))
            return session
        
        # Cross-step intent detection: check if the user's response
        # matches a DIFFERENT step better than the current one.
        # This fixes desync when the AI asks about steps out of order.
        target_step = self._detect_intent_step(session, user_message)
        original_step = session.current_step
        
        if target_step and target_step != session.current_step:
            # User is answering a different step — extract for that step instead
            logger.info(f"Cross-step detection: user message matches {target_step.value} instead of current {session.current_step.value}")
            saved_step = session.current_step
            session.current_step = target_step
            extracted = self._extract_value(session, user_message)
            if extracted:
                session.collected_params[target_step.value] = extracted
                logger.info(f"Cross-step extracted: {target_step.value} = {extracted}")
                defaults_list = session.collected_params.get("_defaults", [])
                if target_step.value in defaults_list:
                    defaults_list.remove(target_step.value)
                    session.collected_params["_defaults"] = defaults_list
            # Restore to original step (don't advance from a different step)
            session.current_step = saved_step
        else:
            # Normal flow: extract for the current step
            extracted = self._extract_value(session, user_message)
            
            if extracted:
                session.collected_params[session.current_step.value] = extracted
                logger.info(f"Extracted for {session.current_step.value}: {extracted}")
                # Mark this param as user-confirmed (remove from defaults list)
                defaults_list = session.collected_params.get("_defaults", [])
                step_key = session.current_step.value
                if step_key in defaults_list:
                    defaults_list.remove(step_key)
                    session.collected_params["_defaults"] = defaults_list
                session.advance_step()
                logger.info(f"Advanced to step: {session.current_step.value}")
                
                # Transition phases
                if session.current_step == ConfigStep.COMPLETE:
                    session.phase = ConversationPhase.REVIEW
        
        # Get AI response
        ai_engine = get_ai_engine()
        
        # Build message history for AI
        msg_history = [
            {"role": m.role, "content": m.content}
            for m in session.messages[-10:]
        ]
        
        ai_response = await ai_engine.generate_response(
            user_message=user_message,
            phase=session.phase.value,
            current_step=session.current_step.value,
            collected_params=session.collected_params,
            message_history=msg_history,
        )
        
        # Add AI response
        session.messages.append(Message(
            id=str(uuid.uuid4()),
            role="assistant",
            content=ai_response,
        ))
        
        session.updated_at = datetime.utcnow()
        return session
    
    def _detect_intent_step(self, session: ConversationSession, message: str) -> Optional[ConfigStep]:
        """Detect if the user's message is answering a different step than the current one.
        
        This handles the case where the AI asks about a step out of order,
        so the user's response needs to be mapped to the correct config field.
        Returns the matching step, or None if the current step is correct.
        """
        msg_lower = message.lower().strip()
        
        # Skip detection for casual messages
        if self._is_casual_message(message):
            return None
        
        # Intent patterns: keyword → ConfigStep mapping
        intent_signals = {
            ConfigStep.PARENT_CHAIN: [
                "mainnet", "testnet", "sepolia", "arbitrum one",
                "arbitrum nova", "production", "main net",
            ],
            ConfigStep.DATA_AVAILABILITY: [
                "anytrust", "any trust", "rollup", "roll up", "roll-up",
                "data availability", "full rollup", "full security",
                "ethereum da", "dac committee",
            ],
            ConfigStep.VALIDATORS: [
                "validator",
            ],
            ConfigStep.OWNER_ADDRESS: [
                "0x", "my wallet", "connected wallet", "my address",
            ],
            ConfigStep.NATIVE_TOKEN: [
                "custom token", "native token", "gas token",
            ],
        }
        
        # Check if message matches a different step
        for step, keywords in intent_signals.items():
            if step == session.current_step:
                continue  # Skip the current step
            if any(kw in msg_lower for kw in keywords):
                return step
        
        return None
    
    def _is_casual_message(self, message: str) -> bool:
        """Check if message is casual chat that shouldn't advance config."""
        msg_lower = message.lower().strip()
        
        # Common greetings and casual messages
        casual_patterns = [
            "hi", "hello", "hey", "hola", "sup", "yo",
            "what's up", "whats up", "wassup",
            "good morning", "good afternoon", "good evening",
            "how are you", "how's it going", "how are things",
            "thanks", "thank you", "thx",
            "ok", "okay", "cool", "nice", "great", "awesome",
            "hmm", "um", "uh", "err",
            "help", "what", "huh", "?",
            "test", "testing", "asdf", "aaa", "bbb",
        ]
        
        # Exact matches or very short non-config messages
        if msg_lower in casual_patterns or len(msg_lower) <= 2:
            return True
        
        # Starts with greeting
        greeting_starters = ["hi ", "hey ", "hello ", "yo "]
        if any(msg_lower.startswith(g) for g in greeting_starters):
            return True
        
        return False
    
    def _extract_value(self, session: ConversationSession, message: str) -> Optional[any]:
        """Extract configuration value from user message based on current step."""
        step = session.current_step
        msg_lower = message.lower().strip()
        
        # Don't advance on casual greetings
        if self._is_casual_message(message):
            return None
        
        if step == ConfigStep.USE_CASE:
            use_case = parse_use_case_from_text(message)
            if use_case:
                # Also set defaults based on use case
                preset = get_preset(use_case)
                session.collected_params["_preset"] = preset
                # Pre-fill all config fields with preset defaults
                # so the configuration panel updates immediately
                defaults = preset.get("defaults", {})
                default_mapping = {
                    "data_availability": defaults.get("data_availability"),
                    "block_time": defaults.get("block_time"),
                    "gas_limit": defaults.get("gas_limit"),
                    "validators": defaults.get("validators"),
                    "challenge_period": defaults.get("challenge_period_days"),
                    "native_token": {"name": "Ether", "symbol": "ETH", "decimals": 18},
                    "parent_chain": "arbitrum-sepolia",
                }
                for key, value in default_mapping.items():
                    if value is not None and key not in session.collected_params:
                        session.collected_params[key] = value
                # Track which params are defaults vs user-confirmed
                session.collected_params["_defaults"] = list(default_mapping.keys())
                return use_case
            # Only return general if message contains use-case keywords
            use_case_keywords = ["app", "chain", "project", "build", "create", "making", "platform"]
            if any(kw in msg_lower for kw in use_case_keywords):
                return "general"
            return None
        
        elif step == ConfigStep.CHAIN_NAME:
            # Reject messages that are clearly about other config steps
            config_keywords = [
                "mainnet", "testnet", "sepolia", "nova", "arbitrum",
                "rollup", "anytrust", "trust",
                "validator", "eth", "ether", "custom token",
                "wallet", "address", "0x",
                "second", "fast", "slow",
                "million", "gas",
                "days", "week", "challenge",
                "production", "deploy",
            ]
            if any(kw in msg_lower for kw in config_keywords):
                return None
            
            name = extract_chain_name_from_text(message)
            if name:
                # Double-check extracted name isn't a config keyword
                if any(kw in name.lower() for kw in config_keywords):
                    return None
                return name
            
            # Accept short single-word or multi-word inputs as chain names
            # Common patterns: "gamify", "my chain", "orbit gaming"
            skip_words = ["the", "a", "an", "is", "be", "it"]
            words = msg_lower.split()
            
            # Single word like "gamify" - very likely a chain name
            if len(words) == 1 and len(message) >= 3 and len(message) <= 50:
                return message.strip()
            
            # Multi-word - check first words aren't just filler
            if len(message) <= 50 and len(message) >= 3:
                # Filter out common filler words to get actual name
                name_parts = [w for w in words if w.lower() not in skip_words]
                if name_parts:
                    return " ".join(name_parts).title()  # Title case for nicer formatting
            
            return None
        
        elif step == ConfigStep.PARENT_CHAIN:
            if "sepolia" in msg_lower or "test" in msg_lower:
                return "arbitrum-sepolia"
            elif "one" in msg_lower or "main" in msg_lower or "production" in msg_lower:
                return "arbitrum-one"
            elif "nova" in msg_lower:
                return "arbitrum-nova"
            # Default yes means sepolia
            elif msg_lower in ["yes", "yeah", "ok", "sure", "sounds good", "yep"]:
                return "arbitrum-sepolia"
            return "arbitrum-sepolia"
        
        elif step == ConfigStep.DATA_AVAILABILITY:
            # Check for rollup FIRST (more specific patterns)
            # This ensures "roll up", "rollup", "roll-up" are detected before "trust" pattern
            rollup_patterns = ["rollup", "roll up", "roll-up", "ethereum da", "full rollup", "full security"]
            if any(pattern in msg_lower for pattern in rollup_patterns):
                return "rollup"
            
            # Check for anytrust patterns
            anytrust_patterns = ["anytrust", "any trust", "any-trust", "cheaper", "fast", "dac"]
            if any(pattern in msg_lower for pattern in anytrust_patterns):
                return "anytrust"
            
            # Default confirmations use preset
            if msg_lower in ["yes", "yeah", "ok", "sure", "sounds good", "yep", "that's fine", "works for me"]:
                preset = session.collected_params.get("_preset", {})
                return preset.get("defaults", {}).get("data_availability", "anytrust")
            
            # Don't default - return None so AI can clarify
            return None
        
        elif step == ConfigStep.VALIDATORS:
            count = parse_validator_count_from_text(message)
            if count:
                return count
            # Default confirmation
            preset = session.collected_params.get("_preset", {})
            return preset.get("defaults", {}).get("validators", 3)
        
        elif step == ConfigStep.OWNER_ADDRESS:
            if extract_wallet_intent(message):
                if session.wallet_address and is_valid_eth_address(session.wallet_address):
                    return normalize_eth_address(session.wallet_address)
                return None
            # Try to extract address from message
            import re
            match = re.search(r"0x[a-fA-F0-9]{40}", message)
            if match:
                return normalize_eth_address(match.group())
            return None
        
        elif step == ConfigStep.NATIVE_TOKEN:
            if "custom" in msg_lower:
                return {"name": "Custom", "symbol": "TOKEN", "decimals": 18}
            # Default is ETH
            return {"name": "Ether", "symbol": "ETH", "decimals": 18}
        
        elif step == ConfigStep.BLOCK_TIME:
            time_val = parse_block_time_from_text(message)
            if time_val:
                return time_val
            # Default confirmation
            preset = session.collected_params.get("_preset", {})
            return preset.get("defaults", {}).get("block_time", 2)
        
        elif step == ConfigStep.GAS_LIMIT:
            # Extract number
            import re
            numbers = re.findall(r"\b(\d{7,9})\b", message)
            if numbers:
                return int(numbers[0])
            if "30" in msg_lower or "standard" in msg_lower:
                return 30_000_000
            if "50" in msg_lower or "high" in msg_lower:
                return 50_000_000
            # Default confirmation
            preset = session.collected_params.get("_preset", {})
            return preset.get("defaults", {}).get("gas_limit", 30_000_000)
        
        elif step == ConfigStep.CHALLENGE_PERIOD:
            if "14" in msg_lower or "two week" in msg_lower:
                return 14
            return 7
        
        return None
    
    def _cleanup_expired(self):
        """Remove expired sessions."""
        now = time.time()
        expired = [
            sid for sid, ts in self.session_timestamps.items()
            if now - ts > self.ttl_seconds
        ]
        for sid in expired:
            del self.sessions[sid]
            del self.session_timestamps[sid]
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")


# Singleton instance
_conversation_manager: Optional[ConversationManager] = None


def get_conversation_manager() -> ConversationManager:
    """Get or create the conversation manager singleton."""
    global _conversation_manager
    if _conversation_manager is None:
        import os
        ttl = int(os.getenv("SESSION_TTL_SECONDS", "7200"))
        _conversation_manager = ConversationManager(ttl_seconds=ttl)
    return _conversation_manager
