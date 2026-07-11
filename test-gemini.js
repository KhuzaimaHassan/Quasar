const { streamText } = require('ai');
const { google } = require('@ai-sdk/google');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const keyLine = envFile.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY='));
process.env.GOOGLE_GENERATIVE_AI_API_KEY = keyLine.split('=')[1].replace(/"/g, '').trim();

async function testGemini() {
  const result = streamText({
    model: google('gemini-3.5-flash'),
    messages: [
      { role: 'user', content: 'Write a Python function to perform a binary search' },
      { role: 'assistant', content: 'Here is the binary search function...\n```python\n# code\n```' },
      { role: 'user', content: 'Explain the difference between let and const in JavaScript.' }
    ]
  });
  
  let fullResponse = '';
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    fullResponse += chunk;
  }
}
testGemini();
