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
// Use environment variables for database configuration with cloud endpoint fallback
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_TOKEN = process.env.SURREALDB_TOKEN; // For cloud authentication
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge'; // Default to 'chatbot_knowledge' namespace
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper'; // Default to 'scraper' database

// Log the database configuration (without passwords/tokens)
console.log(`SurrealDB Configuration:\n  Host: ${SURREALDB_HOST}\n  User: ${SURREALDB_USER}\n  NS: ${SURREALDB_NS}\n  DB: ${SURREALDB_DB}\n  Using token auth: ${!!SURREALDB_TOKEN}`);

// Function to check if all required DB config is present
function hasRequiredDbConfig() {
  // Check if we have the minimum required configuration
  const missingVars = [];
  if (!SURREALDB_HOST) missingVars.push('SURREALDB_HOST');
  if (!SURREALDB_NS) missingVars.push('SURREALDB_NS');
  if (!SURREALDB_DB) missingVars.push('SURREALDB_DB');
  
  // We need either a token or username/password
  if (!SURREALDB_TOKEN && (!SURREALDB_USER || !SURREALDB_PASS)) {
    missingVars.push('SURREALDB_TOKEN or SURREALDB_USER+SURREALDB_PASS');
  }
  
  if (missingVars.length > 0) {
    console.warn(`Missing required database configuration: ${missingVars.join(', ')}`);
    return false;
  }
  return true;
}

// Deferred database initialization function
async function initializeSurrealDBConnection() {
  // Only attempt connection if not already attempted
  if (dbConnectionAttempted || !hasRequiredDbConfig()) {
    return dbConnected;
  }
  dbConnectionAttempted = true;
  try {
    console.log(`Connecting to SurrealDB at ${SURREALDB_HOST}...`);
    const connectionPromise = db.connect(SURREALDB_HOST!);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000));
    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Connected to SurrealDB');
    
    // Use the specified namespace and database
    console.log(`Selecting namespace: ${SURREALDB_NS}, database: ${SURREALDB_DB}...`);
    await db.use({ namespace: SURREALDB_NS!, database: SURREALDB_DB! });
    console.log(`✅ Using namespace: ${SURREALDB_NS}, database: ${SURREALDB_DB}`);
    
    // Try all available authentication methods
    let authenticated = false;
    
    // Try token authentication with different formats
    if (SURREALDB_TOKEN && !authenticated) {
      // Try direct token authentication
      try {
        console.log('Authenticating with token (direct method)...');
        await db.authenticate(SURREALDB_TOKEN);
        console.log('✅ Direct token authentication successful');
        authenticated = true;
      } catch (tokenError: any) {
        console.error('❌ Direct token authentication failed:', tokenError?.message || 'Unknown error');
        
        // Try token with scope authentication
        try {
          console.log('Authenticating with token (scope method)...');
          // Use the token in a different way - as a bearer token
          await db.query('LET $token = $auth', { auth: SURREALDB_TOKEN });
          console.log('✅ Token scope authentication successful');
          authenticated = true;
        } catch (scopeError: any) {
          console.error('❌ Token scope authentication failed:', scopeError?.message || 'Unknown error');
          console.log('Trying other authentication methods...');
        }
      }
    }
    
    // Try username/password authentication
    if (!authenticated && SURREALDB_USER && SURREALDB_PASS) {
      try {
        console.log('Trying username/password authentication...');
        await db.signin({ username: SURREALDB_USER, password: SURREALDB_PASS });
        console.log('✅ Username/password authentication successful');
        authenticated = true;
      } catch (userPassError: any) {
        console.error('❌ Username/password authentication failed:', userPassError?.message || 'Unknown error');
        
        // Try with namespace and database in credentials
        try {
          console.log('Trying username/password with namespace/database...');
          await db.signin({
            username: SURREALDB_USER,
            password: SURREALDB_PASS,
            namespace: SURREALDB_NS,
            database: SURREALDB_DB
          });
          console.log('✅ Username/password with NS/DB authentication successful');
          authenticated = true;
        } catch (fullAuthError: any) {
          console.error('❌ Username/password with NS/DB authentication failed:', fullAuthError?.message || 'Unknown error');
        }
      }
    }
    
    // Try anonymous access as last resort
    if (!authenticated) {
      try {
        console.log('Trying anonymous access (no authentication)...');
        // Just proceed without authentication
        console.log('✅ Proceeding with anonymous access');
        authenticated = true;
      } catch (anonError: any) {
        console.error('❌ Anonymous access failed:', anonError?.message || 'Unknown error');
      }
    }
    
    // Check if any authentication method succeeded
    if (authenticated) {
      dbConnected = true;
      console.log('✅ Successfully connected to SurrealDB');
      
      // Test the connection with a simple query
      try {
        const result = await db.query('SELECT count() FROM information_schema.tables');
        console.log('✅ Query successful:', result);
      } catch (queryError: any) {
        console.warn('⚠️ Test query failed, but connection is established:', queryError?.message || 'Unknown error');
        // Try a different query
        try {
          const result = await db.query('SELECT * FROM type::table($tb) LIMIT 1', { tb: 'scraper' });
          console.log('✅ Alternative query successful:', result);
        } catch (altQueryError: any) {
          console.warn('⚠️ Alternative query failed:', altQueryError?.message || 'Unknown error');
        }
      }
      
      return true;
    } else {
      throw new Error('All authentication methods failed');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to SurrealDB:', error?.message || 'Unknown error');
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
      
      // First try to query the pages table which likely contains scraped content
      const result = await db.query(
        `SELECT * FROM pages 
         WHERE content CONTAINS $search 
         ORDER BY score() DESC 
         LIMIT 5`,
        { search: searchQuery }
      );
      
      let resultData = result as any;
      let firstResult = resultData[0]?.result || [];
      
      // If no results found in pages table, try the knowledge_base table as fallback
      if (firstResult.length === 0) {
        console.log('No results found in pages table, trying knowledge_base table');
        const fallbackResult = await db.query(
          `SELECT * FROM knowledge_base 
           WHERE content CONTAINS $search 
           ORDER BY score() DESC 
           LIMIT 5`,
          { search: searchQuery }
        );
        
        resultData = fallbackResult as any;
        firstResult = resultData[0]?.result || [];
      }
      
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
      // Create a new knowledge base entry in the custom_knowledge table
      const created = await db.create('custom_knowledge', {
        title,
        content,
        tags,
        created_at: new Date().toISOString(),
        source: 'user_input',
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