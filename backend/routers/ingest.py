from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uuid
import asyncio
from datetime import datetime, timezone
import traceback

from core import db
from core.security import verify_internal_secret
from core.storage import download_file
from core.parsing import extract_text
from core.chunking import chunk_text
from core.embeddings import embed_chunks

router = APIRouter()

class IngestRequest(BaseModel):
    document_id: str

async def process_document(document_id: str):
    try:
        if db.pool is None:
            raise RuntimeError("DB pool not initialized")
            
        async with db.pool.acquire() as conn:
            # 1. Fetch Document row (must quote camelCase columns)
            doc_row = await conn.fetchrow(
                'SELECT "storagePath", "mimeType" FROM "Document" WHERE id = $1', 
                document_id
            )
            if not doc_row:
                raise Exception("Document not found during processing")
                
            storage_path = doc_row["storagePath"]
            mime_type = doc_row["mimeType"]
            
        # 2. Download file, 3. Extract text, 4. Chunk, 5. Embed 
        # Offload sync I/O and CPU-bound work to threadpool to avoid blocking the event loop
        file_bytes = await asyncio.to_thread(download_file, storage_path)
        text = await asyncio.to_thread(extract_text, file_bytes, mime_type)
        chunks = await asyncio.to_thread(chunk_text, text)
        
        if chunks:
            embeddings = await asyncio.to_thread(embed_chunks, chunks)
        else:
            embeddings = []
            
        # 6. Insert chunks and embeddings
        async with db.pool.acquire() as conn:
            async with conn.transaction():
                for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                    chunk_id = str(uuid.uuid4())
                    # Convert list of floats to pgvector string format '[1.1, 2.2, ...]'
                    emb_str = "[" + ",".join(map(str, emb)) + "]"
                    metadata_str = "{}"
                    
                    await conn.execute(
                        '''
                        INSERT INTO "Chunk" (id, "documentId", "chunkIndex", content, embedding, metadata, "createdAt")
                        VALUES ($1, $2, $3, $4, $5::vector, $6, now())
                        ''',
                        chunk_id, document_id, i, chunk, emb_str, metadata_str
                    )
                    
                # 7. Update status to 'ready'
                await conn.execute(
                    'UPDATE "Document" SET status = $1, "errorMessage" = NULL WHERE id = $2',
                    'ready', document_id
                )
                
    except Exception as e:
        error_msg = str(e)
        if db.pool:
            try:
                async with db.pool.acquire() as conn:
                    await conn.execute(
                        'UPDATE "Document" SET status = $1, "errorMessage" = $2 WHERE id = $3',
                        'failed', error_msg, document_id
                    )
            except Exception as inner_e:
                print(f"Failed to update document status to failed: {inner_e}")
        print(f"Ingestion failed for {document_id}: {error_msg}")
        traceback.print_exc()

@router.post("/ingest", status_code=202, dependencies=[Depends(verify_internal_secret)])
async def ingest_document(req: IngestRequest, background_tasks: BackgroundTasks):
    if db.pool is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
        
    async with db.pool.acquire() as conn:
        # Validate document exists
        row = await conn.fetchrow('SELECT id FROM "Document" WHERE id = $1', req.document_id)
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
            
        # Update status to processing
        await conn.execute('UPDATE "Document" SET status = $1 WHERE id = $2', 'processing', req.document_id)
        
    background_tasks.add_task(process_document, req.document_id)
    return {"documentId": req.document_id, "status": "processing"}
