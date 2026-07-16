import re
from google.genai import local_tokenizer

tokenizer = local_tokenizer.LocalTokenizer("gemini-2.5-flash")

def get_token_count(text: str) -> int:
    """Helper to safely get token count from LocalTokenizer."""
    if not text.strip():
        return 0
    res = tokenizer.count_tokens(text)
    if hasattr(res, "total_tokens"):
        return res.total_tokens
    return int(res)

def chunk_text(text: str, target_tokens: int = 500, overlap_tokens: int = 60) -> list[str]:
    """
    Chunks text into smaller pieces for embedding, ensuring we don't exceed target_tokens.
    Preserves overlap_tokens between chunks to maintain context.
    """
    # 1. Split text into paragraphs
    raw_paragraphs = text.split("\n\n")
    paragraphs = [p.strip() for p in raw_paragraphs if p.strip()]
    
    # Break down oversized paragraphs into sentences
    units = []
    for p in paragraphs:
        if get_token_count(p) > target_tokens:
            # 3. Split on sentence boundaries if paragraph is too large
            sentences = re.split(r'(?<=[.!?])\s+', p)
            units.extend([s.strip() for s in sentences if s.strip()])
        else:
            units.append(p)
            
    chunks = []
    current_chunk_units = []
    current_tokens = 0
    
    i = 0
    while i < len(units):
        unit = units[i]
        unit_tokens = get_token_count(unit)
        
        # 2. Greedily accumulate until we exceed target_tokens
        if current_tokens + unit_tokens > target_tokens and current_chunk_units:
            # Finalize the current chunk
            chunk_str = "\n\n".join(current_chunk_units)
            # 5. Discard chunks under ~30 tokens
            if get_token_count(chunk_str) >= 30:
                chunks.append(chunk_str)
                
            # 4. Carry the last overlap_tokens worth of text into the next chunk
            overlap_units = []
            overlap_count = 0
            for u in reversed(current_chunk_units):
                u_tok = get_token_count(u)
                if overlap_count + u_tok > overlap_tokens:
                    break
                overlap_units.insert(0, u)
                overlap_count += u_tok
                
            current_chunk_units = overlap_units
            current_tokens = overlap_count
            # We don't increment `i` here, because we still need to add `unit` to the new chunk
        else:
            current_chunk_units.append(unit)
            current_tokens += unit_tokens
            i += 1
            
    # Add the final chunk if it has remaining text
    if current_chunk_units:
        chunk_str = "\n\n".join(current_chunk_units)
        if get_token_count(chunk_str) >= 30:
            chunks.append(chunk_str)
            
    return chunks
