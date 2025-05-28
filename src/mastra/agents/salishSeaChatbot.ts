import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai"; // Your chosen LLM
import { z } from "zod"; // For defining tool schemas
import { Surreal } from 'surrealdb'; // SurrealDB client (updated package)
import { createTool } from "@mastra/core/tools"; // For creating tools

// --- Initialize SurrealDB Connection ---
// These environment variables will be picked up from Railway's config
const SURREALDB_HOST = process.env.SURREALDB_HOST!;
const SURREALDB_USER = process.env.SURREALDB_USER!;
const SURREALDB_PASS = process.env.SURREALDB_PASS!;
const SURREALDB_NS = process.env.SURREALDB_NS!;
const SURREALDB_DB = process.env.SURREALDB_DB!;

// Initialize SurrealDB client
const db = new Surreal();

// Function to connect to SurrealDB and test the connection
async function connectToSurrealDB() {
  try {
    // Connect to the database
    await db.connect(SURREALDB_HOST);
    
    // Select a specific namespace / database
    await db.use({
      namespace: SURREALDB_NS,
      database: SURREALDB_DB
    });
    
    // Signin with credentials
    await db.signin({
      username: SURREALDB_USER,
      password: SURREALDB_PASS
    });
    
    console.log("Connected to SurrealDB successfully!");
    
    // Optional: Make a very simple query to ensure the connection is active
    const result = await db.query("INFO FOR DB");
    console.log("Connection verified with query result:", result);
  } catch (error) {
    console.error("Failed to connect to SurrealDB:", error);
    // Log any connection errors to see them in Railway logs
  }
}

// Call connectToSurrealDB on application startup
connectToSurrealDB();

// --- Define a Mock RAG Tool ---
// This tool will simulate querying your knowledge base and check SurrealDB status
const knowledgeBaseTool = createTool({
  id: "knowledgeBase",
  description: "This tool queries the Salish Sea Consulting knowledge base to retrieve relevant information.",
  inputSchema: z.object({
    query: z.string().describe("The user's question, optimized for knowledge base search."),
  }),
  execute: async ({ context }) => {
    const { query } = context;
    let surrealDbStatus = "Disconnected or Error";
    try {
        // Attempt a simple SurrealDB operation to confirm connection
        const result = await db.query("INFO FOR DB");
        surrealDbStatus = "Connected and operational";
    } catch (error: any) { // Use 'any' for simpler error handling in demo
        surrealDbStatus = `Failed to confirm connection: ${error.message}`;
    }
    // This is the mock response returned to the LLM
    return `MOCK RAG: I received the query "${query}". SurrealDB connection status: ${surrealDbStatus}. In a real scenario, I would search our knowledge base in SurrealDB and provide detailed information from our content.`;
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
  model: openai(process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini"), // Your main chat model
  tools: {
    knowledgeBase: knowledgeBaseTool, // Use the tool directly
  },
});