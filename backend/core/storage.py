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
