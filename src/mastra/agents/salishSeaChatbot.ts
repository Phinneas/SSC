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
// Use environment variables for database configuration
const SURREALDB_HOST = process.env.SURREALDB_HOST;
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS;
const SURREALDB_DB = process.env.SURREALDB_DB;

// Log the database configuration (without passwords)
console.log(`SurrealDB Configuration:\n  Host: ${SURREALDB_HOST}\n  User: ${SURREALDB_USER}\n  NS: ${SURREALDB_NS}\n  DB: ${SURREALDB_DB}`);

// Function to check if all required DB config is present
function hasRequiredDbConfig() {
  const missingVars = [];
  if (!SURREALDB_HOST) missingVars.push('SURREALDB_HOST');
  if (!SURREALDB_USER) missingVars.push('SURREALDB_USER');
  if (!SURREALDB_PASS) missingVars.push('SURREALDB_PASS');
  if (!SURREALDB_NS) missingVars.push('SURREALDB_NS');
  if (!SURREALDB_DB) missingVars.push('SURREALDB_DB');
  
  if (missingVars.length > 0) {
    console.warn(`Missing required database configuration: ${missingVars.join(', ')}`);
    return false;
  }
  return true;
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
    
    try {
      // Set a timeout for the connection attempt
      const connectionPromise = db.connect(SURREALDB_HOST!);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      );
      
      // Race the connection against a timeout
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error: any) {
      console.error(`Failed to connect to SurrealDB: ${error.message}`);
      if (error.cause?.code === 'ENOTFOUND') {
        console.error(`Could not resolve hostname: ${SURREALDB_HOST}. Please check your network connection or DNS settings.`);
      }
      throw error;
    }
    
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

// --- Define the actual RAG Tool using SurrealDB ---
const knowledgeBaseTool = createTool({
  id: "knowledgeBase",
  description: "This tool queries the Salish Sea Consulting knowledge base to retrieve relevant information.",
  inputSchema: z.object({
    query: z.string().describe("The user's question, optimized for knowledge base search."),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    
    // If not connected to the database, try to connect now
    if (!dbConnected && !dbConnectionAttempted) {
      await initializeSurrealDBConnection();
    }
    
    // If still not connected, return a fallback response with mock data
    if (!dbConnected) {
      console.log('Using fallback mock data since database connection failed');
      return `I'm currently operating with limited data due to database connection issues. Here's some general information about Salish Sea Consulting:

- Specializes in marine ecosystem management and conservation
- Offers services in environmental impact assessment for coastal projects
- Has expertise in sustainable fisheries management and aquaculture
- Provides data-driven solutions for coastal communities and businesses
- Conducts research on marine biodiversity and ecosystem health

For more specific information, please try again later when the database connection is restored.`;
    }
    
    try {
      // Convert the query into a vector search query (simplified version)
      // In a real implementation, you would use embedding models to vectorize the query
      const searchQuery = query.toLowerCase().trim();
      
      // Query the database for relevant information
      // This is a simplified example - in a real implementation you would:
      // 1. Convert the query to an embedding vector
      // 2. Perform a vector similarity search in SurrealDB
      const result = await db.query(
        `SELECT * FROM knowledge_base 
         WHERE content CONTAINS $search 
         ORDER BY score() DESC 
         LIMIT 5`,
        { search: searchQuery }
      );
      
      // Process the results
      const resultData = result as any;
      const firstResult = resultData[0]?.result || [];
      
      if (firstResult.length === 0) {
        return `I couldn't find any information related to "${query}" in the Salish Sea Consulting knowledge base. Would you like to ask about another topic?`;
      }
      
      // Format the results into a coherent response
      const formattedResults = firstResult.map((item: any) => {
        return `${item.title || 'Information'}:\n${item.content || 'No content available'}`;
      }).join('\n\n');
      
      return `Here's what I found about "${query}" in the Salish Sea Consulting knowledge base:\n\n${formattedResults}`;
    } catch (error: any) {
      console.error("Database query error in RAG tool:", error);
      return `I encountered an error while searching for information about "${query}". Error details: ${error.message}. Please try again or rephrase your question.`;
    }
  },
});

// --- Tool to create new knowledge base entries ---
const addKnowledgeTool = createTool({
  id: "addKnowledge",
  description: "This tool adds new information to the Salish Sea Consulting knowledge base.",
  inputSchema: z.object({
    title: z.string().describe("Title or topic of the knowledge entry"),
    content: z.string().describe("The detailed information to store in the knowledge base"),
    tags: z.array(z.string()).optional().describe("Optional tags to categorize the knowledge")
  }),
  execute: async ({ context }) => {
    const { title, content, tags = [] } = context;
    
    // If not connected to the database, try to connect now
    if (!dbConnected && !dbConnectionAttempted) {
      await initializeSurrealDBConnection();
    }
    
    // If still not connected, return an error message
    if (!dbConnected) {
      return `Unable to add to the knowledge base due to database connection issues. Please try again later.`;
    }
    
    try {
      // Create a new knowledge base entry
      const created = await db.create('knowledge_base', {
        title,
        content,
        tags,
        created_at: new Date().toISOString(),
      });
      
      return `Successfully added new knowledge to the database with title: "${title}".`;
    } catch (error: any) {
      console.error("Error adding knowledge to database:", error);
      return `Failed to add knowledge to the database. Error: ${error.message}`;
    }
  },
});

// --- Define your main Chatbot Agent ---
export const salishSeaChatbot = new Agent({
  name: "salishSeaChatbot",
  instructions: `You are a helpful and professional AI assistant for Salish Sea Consulting. Your goal is to answer questions based on the provided knowledge base.
  - If a question can be answered from the provided context, summarize it concisely and professionally.
  - Use the knowledgeBase tool to get information from the SurrealDB database.
  - If you're asked to add new information to the knowledge base, use the addKnowledge tool.
  - If you cannot find relevant information, politely state that you don't have enough information to answer that specific question from the available knowledge base and suggest they visit the website directly or contact the team.
  - Maintain a tone that is knowledgeable, reassuring, and aligned with a professional consulting firm.
  - Do not invent information or hallucinate.
  - For Salish Sea Consulting staff: you can add new information to the knowledge base by asking to "add knowledge about [topic]" and providing the details.`,
  model: openai(process.env.OPENAI_API_KEY ? "gpt-4o" : "gpt-4o-mini"),
  tools: {
    knowledgeBase: knowledgeBaseTool,
    addKnowledge: addKnowledgeTool,
  },
});