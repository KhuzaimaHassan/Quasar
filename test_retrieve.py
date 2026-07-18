import urllib.request
import urllib.error
import json

url = "http://localhost:8000/retrieve"
headers = {
    "Content-Type": "application/json",
    "X-Internal-Secret": "dev_internal_secret"
}
data = {
    "workspace_id": "c3718835-6fb0-41fe-b91e-06fb626fe58b",
    "query": "What is Khuzaima Hassan experience?",
    "top_k": 5
}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"Error: {e.code} - {e.read().decode()}")
