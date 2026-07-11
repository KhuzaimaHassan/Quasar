const ai = require('ai');
const messages = [
  { role: 'user', content: 'hello' },
  { role: 'error', content: 'An error occurred' },
  { role: 'assistant', content: 'Hi' }
];
console.log(ai.convertToModelMessages(messages));
