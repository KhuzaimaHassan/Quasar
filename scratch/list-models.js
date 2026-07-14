import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

async function run() {
  const models = await genAI.getModels(); // wait getModels is not available like this in v1?
  // Let's just try to fetch via REST
}
