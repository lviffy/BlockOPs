"""
Input validators for Ethereum addresses, chain IDs, etc.
"""
import re
from typing import Optional


def is_valid_eth_address(address: str) -> bool:
    """Validate Ethereum address format."""
    if not address:
        return False
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))


def normalize_eth_address(address: str) -> str:
    """Normalize Ethereum address to lowercase with 0x prefix."""
    if not address:
        raise ValueError("Address cannot be empty")
    
    # Add 0x prefix if missing
    if not address.startswith("0x"):
        address = "0x" + address
    
    if not is_valid_eth_address(address):
        raise ValueError(f"Invalid Ethereum address: {address}")
    
    return address.lower()


def is_valid_chain_id(chain_id: int) -> bool:
    """Validate L3 chain ID is in acceptable range."""
    # L3 chains should use IDs in 412000-999999 range
    return 412000 <= chain_id <= 999999


def generate_chain_id() -> int:
    """Generate a random unique chain ID for L3."""
    import random
    return random.randint(412000, 499999)


def validate_validators_count(count: int) -> bool:
    """Validate number of validators is reasonable."""
    return 1 <= count <= 20


def parse_validator_count_from_text(text: str) -> Optional[int]:
    """Extract validator count from natural language."""
    text = text.lower()
    
    # Direct numbers
    numbers = re.findall(r"\b(\d+)\b", text)
    if numbers:
        count = int(numbers[0])
        if validate_validators_count(count):
            return count
    
    # Word numbers
    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }
    for word, num in word_to_num.items():
        if word in text:
            return num
    
    return None


def parse_block_time_from_text(text: str) -> Optional[int]:
    """Extract block time from natural language (in seconds)."""
    text = text.lower()
    
    # Look for patterns like "1s", "1 second", "1 sec"
    patterns = [
        r"(\d+)\s*s(?:ec(?:ond)?s?)?",
        r"(\d+)\s*second",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            time = int(match.group(1))
            if 1 <= time <= 30:
                return time
    
    # Keywords
    if "fast" in text or "quick" in text:
        return 1
    if "slow" in text:
        return 3
    
    return None


def parse_use_case_from_text(text: str) -> Optional[str]:
    """Detect use case from natural language description."""
    text = text.lower()
    
    use_cases = {
        "gaming": ["gaming", "game", "player", "esports", "nft game", "play to earn", "p2e"],
        "defi": ["defi", "finance", "trading", "exchange", "lending", "yield", "swap", "dex"],
        "enterprise": ["enterprise", "private", "business", "corporate", "internal"],
        "nft": ["nft", "collectible", "art", "marketplace", "token"],
        "general": ["general", "basic", "simple"],
    }
    
    for use_case, keywords in use_cases.items():
        for keyword in keywords:
            if keyword in text:
                return use_case
    
    return None


def extract_chain_name_from_text(text: str) -> Optional[str]:
    """Try to extract a chain name from user input."""
    # Pattern: "called X", "named X", "name is X", "name: X"
    patterns = [
        r"(?:called|named|name\s+is|name:)\s+[\"']?([a-zA-Z0-9\s]+)[\"']?",
        r"^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)",  # Title case words at start
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            if len(name) >= 2 and len(name) <= 50:
                return name
    
    return None


def extract_wallet_intent(text: str) -> bool:
    """Check if user wants to use their connected wallet."""
    text = text.lower()
    wallet_phrases = [
        "my wallet", "connected wallet", "use my", "my address",
        "current wallet", "this wallet", "same wallet",
    ]
    return any(phrase in text for phrase in wallet_phrases)
