

const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const keyLine = envFile.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY='));
const key = keyLine.split('=')[1].replace(/"/g, '').trim();

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    console.log('Available models:');
    for (const model of data.models) {
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`- ${model.name}`);
      }
    }
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

listModels();
