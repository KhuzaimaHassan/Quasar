import logging
import string
from typing import List, Dict, Any
from rank_bm25 import BM25Okapi

logger = logging.getLogger(__name__)

def simple_tokenize(text: str) -> List[str]:
    # Lowercase and strip punctuation
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    # Split on whitespace
    return text.split()

def rerank_chunks(query: str, chunks: List[Dict[str, Any]], top_k: int) -> List[Dict[str, Any]]:
    if not chunks:
        return []

    # 1. Tokenize candidate chunks
    tokenized_corpus = [simple_tokenize(chunk['content']) for chunk in chunks]
    
    # 2. Build BM25 index
    bm25 = BM25Okapi(tokenized_corpus)
    
    # 3. Score the tokenized query
    tokenized_query = simple_tokenize(query)
    bm25_scores = bm25.get_scores(tokenized_query)
    
    # 4. Compute rankings
    # The original order of chunks is their vector ranking (already sorted descending by similarity)
    # So vector_rank is just the index + 1
    
    # Compute BM25 rankings
    # Create a list of (index, score) and sort by score descending
    indexed_bm25_scores = list(enumerate(bm25_scores))
    indexed_bm25_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Create a mapping from chunk index to bm25 rank
    bm25_ranks = {}
    for rank, (idx, score) in enumerate(indexed_bm25_scores):
        bm25_ranks[idx] = rank + 1  # 1-indexed

    # 5. Apply Reciprocal Rank Fusion
    k = 60
    rrf_scored_chunks = []
    
    for idx, chunk in enumerate(chunks):
        vector_rank = idx + 1
        bm25_rank = bm25_ranks[idx]
        
        rrf_score = 1.0 / (k + vector_rank) + 1.0 / (k + bm25_rank)
        
        # Create a shallow copy to inject RRF metadata without mutating the original
        chunk_with_rrf = dict(chunk)
        chunk_with_rrf['_vector_rank'] = vector_rank
        chunk_with_rrf['_bm25_rank'] = bm25_rank
        chunk_with_rrf['rrf_score'] = rrf_score
        
        rrf_scored_chunks.append(chunk_with_rrf)

    # 6. Sort all chunks by rrf_score descending
    rrf_scored_chunks.sort(key=lambda x: x['rrf_score'], reverse=True)
    
    # Keep top_k
    final_chunks = rrf_scored_chunks[:top_k]
    
    # 7. Log pre/post rerank positions
    for final_rank, chunk in enumerate(final_chunks):
        logger.info(
            f"RRF Final Rank {final_rank + 1} | Chunk ID: {chunk['id']} | "
            f"Original Vector Rank: {chunk['_vector_rank']} | BM25 Rank: {chunk['_bm25_rank']} | "
            f"RRF Score: {chunk['rrf_score']:.6f}"
        )
        
        # Clean up temporary keys before returning (optional, but keeps response clean)
        del chunk['_vector_rank']
        del chunk['_bm25_rank']
        del chunk['rrf_score']

    return final_chunks
