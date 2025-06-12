// Test script for SurrealDB connection
import { Surreal } from 'surrealdb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_TOKEN = process.env.SURREALDB_TOKEN;
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

console.log('Testing SurrealDB connection...');
console.log(`Host: ${SURREALDB_HOST}`);
console.log(`Namespace: ${SURREALDB_NS}`);
console.log(`Database: ${SURREALDB_DB}`);
console.log(`Using token: ${!!SURREALDB_TOKEN}`);
console.log(`Username available: ${!!SURREALDB_USER}`);
console.log(`Password available: ${!!SURREALDB_PASS}`);
console.log();

// If token exists, decode and show expiration
if (SURREALDB_TOKEN) {
  try {
    const tokenParts = SURREALDB_TOKEN.split('.');
    if (tokenParts.length === 3) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log('Token payload:', payload);
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        console.log(`Token expiration: ${expDate.toLocaleString()}`);
        const now = new Date();
        console.log(`Current time: ${now.toLocaleString()}`);
        console.log(`Token ${expDate > now ? 'is valid' : 'has expired'}`);
      }
    }
  } catch (e) {
    console.log('Could not decode token:', e.message);
  }
}

async function testConnection() {
  const db = new Surreal();
  
  try {
    console.log('\nConnecting to database...');
    await db.connect(SURREALDB_HOST);
    console.log('✅ Connected successfully!');
    
    console.log('\nSelecting namespace and database...');
    await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });
    console.log(`✅ Using NS: ${SURREALDB_NS}, DB: ${SURREALDB_DB}`);
    
    // Try token authentication first
    if (SURREALDB_TOKEN) {
      try {
        console.log('\nAuthenticating with token...');
        await db.authenticate(SURREALDB_TOKEN);
        console.log('✅ Token authentication successful!');
        
        // Test a simple query
        console.log('\nTesting query...');
        const result = await db.query('SELECT * FROM information_schema.tables LIMIT 5');
        console.log('✅ Query successful!');
        console.log('Tables:', result);
        
        return true;
      } catch (tokenError) {
        console.log(`❌ Token authentication failed: ${tokenError.message}`);
        
        // If token has specific details, log them
        if (tokenError.details) {
          console.log('Token error details:', tokenError.details);
        }
      }
    }
    
    // Try direct root authentication (for SurrealDB Cloud)
    try {
      console.log('\nTrying root authentication for SurrealDB Cloud...');
      await db.signin({
        NS: SURREALDB_NS,
        DB: SURREALDB_DB,
        SC: 'root',
      });
      console.log('✅ Root authentication successful!');
      
      // Test a simple query
      console.log('\nTesting query...');
      const result = await db.query('SELECT * FROM information_schema.tables LIMIT 5');
      console.log('✅ Query successful!');
      console.log('Tables:', result);
      
      return true;
    } catch (rootError) {
      console.log(`❌ Root authentication failed: ${rootError.message}`);
    }
    
    // Fall back to username/password authentication
    if (SURREALDB_USER && SURREALDB_PASS) {
      try {
        console.log('\nFalling back to username/password authentication...');
        await db.signin({ username: SURREALDB_USER, password: SURREALDB_PASS });
        console.log('✅ Username/password authentication successful!');
        
        // Test a simple query
        console.log('\nTesting query...');
        const result = await db.query('SELECT * FROM information_schema.tables LIMIT 5');
        console.log('✅ Query successful!');
        console.log('Tables:', result);
        
        return true;
      } catch (userPassError) {
        console.log(`❌ Username/password authentication failed: ${userPassError.message}`);
        
        // If error has specific details, log them
        if (userPassError.details) {
          console.log('Auth error details:', userPassError.details);
        }
      }
    }
    
    // Try a simple query to test permissions
    console.log('\nTesting query execution...');
    const result = await db.query('INFO FOR DB;');
    console.log('✅ Query executed successfully!');
    console.log('\nDatabase information:');
    console.log(JSON.stringify(result, null, 2));
    
    // Try to list tables
    console.log('\nListing tables...');
    const tables = await db.query('SHOW TABLES;');
    console.log('✅ Tables retrieved successfully!');
    console.log('\nTables:');
    console.log(JSON.stringify(tables, null, 2));
    
    console.log('\n✅ Connection test completed successfully!');
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(error);
  } finally {
    // Close the connection
    await db.close();
    console.log('\nConnection closed.');
  }
}

// Run the test
testConnection();
