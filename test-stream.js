const ai = require('ai');
console.log('AI Exports:', Object.keys(ai).filter(k => k.toLowerCase().includes('response') || k.toLowerCase().includes('stream')));
