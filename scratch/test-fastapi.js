require('dotenv').config({ path: '.env.local' });

async function testFastAPI() {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  const url = process.env.FASTAPI_SERVICE_URL;

  if (!secret || !url) {
    console.error("Missing INTERNAL_SERVICE_SECRET or FASTAPI_SERVICE_URL in .env.local");
    return;
  }

  console.log(`Testing FastAPI at ${url}/ping...`);
  
  try {
    const res = await fetch(`${url}/ping`, {
      headers: {
        'X-Internal-Secret': secret
      }
    });

    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(`Response body: ${text}`);
      return;
    }

    const data = await res.json();
    console.log("Success! Response from FastAPI:");
    console.log(data);
  } catch (err) {
    console.error("Fetch failed. Is the FastAPI server running?");
    console.error(err.message);
  }
}

testFastAPI();
