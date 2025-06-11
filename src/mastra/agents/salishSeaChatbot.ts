import { Agent } from '@mastra/core';
import { createTool } from "@mastra/core/tools";
import { z } from 'zod';
import { openai } from "@ai-sdk/openai";

// Import SurrealDB client
import { Surreal } from 'surrealdb';
const db = new Surreal();

// Database connection state
let dbConnected = false;
let dbConnectionAttempted = false;

// --- SurrealDB Connection Configuration ---
// Use optional chaining to prevent errors if env vars are missing
const SURREALDB_HOST = process.env.SURREALDB_HOST;
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS;
const SURREALDB_DB = process.env.SURREALDB_DB;

// Function to check if all required DB config is present
function hasRequiredDbConfig() {
  return !!SURREALDB_HOST && !!SURREALDB_USER && !!SURREALDB_PASS && !!SURREALDB_NS && !!SURREALDB_DB;
}

// Deferred database initialization function
async function initializeSurrealDBConnection() {
  // Only attempt connection if not already attempted and all config is present
  if (dbConnectionAttempted || !hasRequiredDbConfig()) {
    return false;
  }
  
  dbConnectionAttempted = true;
  console.log('Attempting deferred SurrealDB connection...');
  
  try {
    console.log(`Connecting to SurrealDB at ${SURREALDB_HOST}...`);
    
    // Set a timeout for the connection attempt
    const connectionPromise = db.connect(SURREALDB_HOST!);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
    );
    
    // Race the connection against a timeout
    await Promise.race([connectionPromise, timeoutPromise]);
    
    // Select a specific namespace / database
    await db.use({
      namespace: SURREALDB_NS!,
      database: SURREALDB_DB!
    });
    
    // Signin with credentials
    await db.signin({
      username: SURREALDB_USER!,
      password: SURREALDB_PASS!
    });
    
    console.log("Connected to SurrealDB successfully!");
    dbConnected = true;
    return true;
  } catch (error) {
    console.error("Failed to connect to SurrealDB:", error);
    console.log("Application will continue without database connection");
    return false;
  }
}

// We'll attempt to connect to the database after a delay to ensure the server starts first
setTimeout(() => {
  initializeSurrealDBConnection()
    .catch(err => {
      console.error("SurrealDB initialization failed at top level:", err);
      console.log("Application will continue running without database connection");
    });
}, 5000); // Wait 5 seconds before attempting to connect

// --- Define a Mock RAG Tool (updated to check SurrealDB) ---
const knowledgeBaseTool = createTool({
  id: "knowledgeBase",
  description: "This tool queries the Salish Sea Consulting knowledge base to retrieve relevant information.",
  inputSchema: z.object({
    query: z.string().describe("The user's question, optimized for knowledge base search."),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    let surrealDbStatus = "Disconnected or Error";
    
    // Only attempt to query the database if we're connected
    if (dbConnected) {
      try {
        const result = await db.query("INFO FOR DB");
        surrealDbStatus = "Connected and operational";
      } catch (error: any) {
        // Don't let database errors crash the application
        console.error("Database query error in RAG tool:", error);
        surrealDbStatus = `Error during query: ${error.message}`;
      }
    } else {
      surrealDbStatus = "Not connected - application running in limited mode";
    }
    
    return `MOCK RAG: Your query was "${query}". SurrealDB connection status: ${surrealDbStatus}.\n\nHere's some mock data about Salish Sea Consulting:\n- Specializes in marine ecosystem management\n- Offers services in environmental impact assessment\n- Has expertise in sustainable fisheries management\n- Provides data-driven solutions for coastal communities`;
  },
});

// --- Define your main Chatbot Agent ---
export const salishSeaChatbot = new Agent({
  name: "salishSeaChatbot",
  instructions: `You are a helpful and professional AI assistant for Salish Sea Consulting. Your goal is to answer questions based on the provided knowledge base.
  - If a question can be answered from the provided context, summarize it concisely and professionally.
  - Use the knowledgeBase tool to get information.
  - If you cannot find relevant information, politely state that you don't have enough information to answer that specific question from the available knowledge base and suggest they visit the website directly or contact the team.
  - Maintain a tone that is knowledgeable, reassuring, and aligned with a professional consulting firm.
  - Do not invent information or hallucinate.`,
  model: openai(process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini"),
  tools: {
    knowledgeBase: knowledgeBaseTool,
  },
});