import os
import asyncio
import asyncpg
from urllib.parse import urlparse

async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set")
        return

    # Parse and strip pgbouncer=true if needed
    url = database_url.split("?")[0]
    
    conn = await asyncpg.connect(url)
    
    # Conversations with gemini-2.5-pro
    query = """
    SELECT c.id, c."userId", u.id as user_id
    FROM conversations c
    JOIN users u ON c."userId" = u.id
    WHERE c.model = 'gemini-2.5-pro'
    """
    convos = await conn.fetch(query)
    
    missing_count = 0
    for row in convos:
        # Check if this user has a google API key
        key_query = """
        SELECT COUNT(*) FROM "ApiKey" WHERE "userId" = $1 AND provider = 'google'
        """
        count = await conn.fetchval(key_query, row['userId'])
        if count == 0:
            missing_count += 1
            
    print(f"Found {len(convos)} total conversations using gemini-2.5-pro.")
    print(f"Of those, {missing_count} belong to users with NO google API key on file.")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
