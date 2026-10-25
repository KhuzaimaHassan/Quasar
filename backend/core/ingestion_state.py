from typing import Any


async def claim_document(connection: Any, document_id: str) -> bool:
    claimed = await connection.fetchval(
        '''UPDATE "Document" AS d SET status = 'processing', "errorMessage" = NULL, "updatedAt" = now()
           WHERE d.id = $1 AND (
             d.status IN ('pending', 'failed') OR (
               d.status = 'ready' AND NOT EXISTS (
                 SELECT 1 FROM "Chunk" c WHERE c."documentId" = d.id
               )
             )
           ) RETURNING d.id''',
        document_id,
    )
    return claimed is not None
