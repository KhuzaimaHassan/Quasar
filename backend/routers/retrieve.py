from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import traceback

from core.security import verify_internal_secret
from core.embeddings import embed_query
from core.retrieval import retrieve_chunks
from core.reranking import rerank_chunks

router = APIRouter()

class RetrieveRequest(BaseModel):
    workspace_id: str
    query: str = Field(..., min_length=1)
    top_k: int = 5

@router.post("/retrieve", dependencies=[Depends(verify_internal_secret)])
async def retrieve_documents(req: RetrieveRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        # 1. Embed the user's query
        query_embedding = embed_query(req.query)
        
        # 2. Retrieve relevant chunks from the database (requesting 2x for reranking candidates)
        chunks = await retrieve_chunks(
            workspace_id=req.workspace_id,
            query_embedding=query_embedding,
            top_k=req.top_k * 2
        )
        
        # 3. Rerank chunks using Reciprocal Rank Fusion
        final_chunks = rerank_chunks(req.query, chunks, req.top_k)
        
        # 4. Return the chunks
        return {"chunks": final_chunks}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during retrieval: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An error occurred during retrieval")
