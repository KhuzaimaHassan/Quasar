import logging
from typing import List, Dict, Any
from core import db

logger = logging.getLogger(__name__)

async def retrieve_chunks(
    workspace_id: str, 
    query_embedding: List[float], 
    top_k: int = 5, 
    similarity_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Retrieves the most semantically relevant chunks for a given query embedding within a specific workspace.
    Filters out chunks from documents that are not 'ready'.
    """
    if db.pool is None:
        raise RuntimeError("Database pool not initialized")

    # Format the embedding vector as a string for pgvector '[1.1, 2.2, ...]'
    emb_str = "[" + ",".join(map(str, query_embedding)) + "]"

    query = '''
        SELECT c.id, c.content, c."chunkIndex", c.metadata,
               d.filename, d.id AS "documentId",
               1 - (c.embedding <=> $1::vector) AS similarity
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        WHERE d."workspaceId" = $2
          AND d.status = 'ready'
          AND 1 - (c.embedding <=> $1::vector) > $3
        ORDER BY c.embedding <=> $1::vector ASC
        LIMIT $4
    '''

    async with db.pool.acquire() as conn:
        rows = await conn.fetch(query, emb_str, workspace_id, similarity_threshold, top_k)

    if not rows:
        logger.info(f"Retrieval for workspace {workspace_id}: 0 chunks passed the {similarity_threshold} threshold or no ready documents found.")
        return []

    results = []
    for row in rows:
        # Convert asyncpg Record to dict
        result_dict = dict(row)
        results.append(result_dict)
        logger.info(f"Retrieved chunk {result_dict['id']} from {result_dict['filename']} with similarity score: {result_dict['similarity']:.4f}")

    return results
