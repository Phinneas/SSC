// Script to generate a SurrealDB token
import { Surreal } from 'surrealdb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const db = new Surreal();

// Get credentials from environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot-knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

async function generateToken() {
  try {
    console.log(`Connecting to ${SURREALDB_HOST}...`);
    
    // Connect to the database
    await db.connect(SURREALDB_HOST);
    
    console.log('Connected! Signing in...');
    
    // Sign in as a user
    await db.signin({
      username: SURREALDB_USER,
      password: SURREALDB_PASS,
    });
    
    console.log('Signed in! Using namespace and database...');
    
    // Use the namespace and database
    await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });
    
    console.log('Generating token...');
    
    // Generate a token valid for one year
    const result = await db.query(`
      DEFINE TOKEN api_token ON DATABASE 
      TYPE HS512 
      VALUE "ssc_chatbot_secret_key" 
      DURATION 8760h;
    `);
    
    console.log('Generated token:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

generateToken();
