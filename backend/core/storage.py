from supabase import create_client, Client
from .config import settings

# Initialize Supabase client with the service role key to bypass Row Level Security
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

def download_file(storage_path: str) -> bytes:
    """
    Downloads a file from the Supabase 'uploads' bucket using the service role key.
    Returns the raw file bytes.
    """
    # Download the file synchronously as bytes
    res = supabase.storage.from_("uploads").download(storage_path)
    return res

def upload_text(storage_path: str, content: str) -> None:
    """
    Upserts (creates or overwrites) a text file in the Supabase 'uploads' bucket.
    """
    file_bytes = content.encode("utf-8")
    supabase.storage.from_("uploads").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "text/plain", "x-upsert": "true"}
    )

def list_objects(prefix: str) -> list[str]:
    """
    Lists object paths under a given prefix in the Supabase 'uploads' bucket.
    """
    # The list method returns objects inside the directory specified by 'path'
    res = supabase.storage.from_("uploads").list(path=prefix)
    
    paths = []
    for item in res:
        name = item.get("name")
        if not name or name == ".emptyFolderPlaceholder":
            continue
            
        if prefix:
            clean_prefix = prefix.rstrip('/')
            paths.append(f"{clean_prefix}/{name}")
        else:
            paths.append(name)
            
    return paths

def delete_object(storage_path: str) -> None:
    """
    Deletes a file from the Supabase 'uploads' bucket.
    """
    supabase.storage.from_("uploads").remove([storage_path])
