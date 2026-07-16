import time
from typing import List
from google import genai
from google.genai import types
from .config import settings

# Initialize genai client explicitly using the API key from settings
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

def embed_chunks(chunks: List[str]) -> List[List[float]]:
    """
    Embeds a list of text chunks using Gemini's embedding model.
    Batches the chunks into groups of 20 and uses exponential backoff for rate limits.
    """
    all_embeddings = []
    batch_size = 20
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        batch_embeddings = _embed_batch_with_retry(batch)
        all_embeddings.extend(batch_embeddings)
        
    return all_embeddings

def _embed_batch_with_retry(batch: List[str], max_retries: int = 3) -> List[List[float]]:
    retries = 0
    delay = 2  # start with 2 seconds
    
    while True:
        try:
            response = client.models.embed_content(
                model='gemini-embedding-001',
                contents=batch,
                config=types.EmbedContentConfig(
                    output_dimensionality=768,
                    task_type="RETRIEVAL_DOCUMENT"
                )
            )
            # response.embeddings is a list of objects, each having a `.values` attribute (List[float])
            return [emb.values for emb in response.embeddings]
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "rate" in error_str:
                if retries >= max_retries:
                    raise Exception(f"Failed to embed batch after {max_retries} retries: {e}") from e
                
                print(f"Rate limit hit during embedding. Retrying in {delay} seconds...")
                time.sleep(delay)
                retries += 1
                delay *= 2
            else:
                # If it's a completely different error, fail immediately
                raise
