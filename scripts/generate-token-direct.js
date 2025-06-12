#!/usr/bin/env node
/**
 * Direct Token Generator for SurrealDB
 * 
 * This script generates a JWT token for SurrealDB authentication and updates the .env file.
 * No interactive prompts - just generates a token with sensible defaults.
 */

import jwt from 'jsonwebtoken';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Surreal } from 'surrealdb';

// Load environment variables
dotenv.config();

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

// Get environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Token configuration
const TOKEN_SECRET = 'ssc_chatbot_secret_key';
const TOKEN_EXPIRATION_DAYS = 365;

// Helper to decode and display token info
function decodeToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      console.log('❌ Invalid token format');
      return null;
    }
    
    const payload = decoded.payload;
    const expiration = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'No expiration';
    const issuedAt = payload.iat ? new Date(payload.iat * 1000).toLocaleString() : 'Unknown';
    
    console.log('\n📝 Token Information:');
    console.log('  • Issued at:', issuedAt);
    console.log('  • Expires at:', expiration);
    console.log('  • Namespace:', payload.ns || 'Not specified');
    console.log('  • Database:', payload.db || 'Not specified');
    console.log('  • Issuer:', payload.iss || 'Not specified');
    console.log('  • Subject:', payload.sub || 'Not specified');
    
    // Check if token is expired
    if (payload.exp && Date.now() > payload.exp * 1000) {
      console.log('❌ Token is EXPIRED');
    } else if (payload.exp) {
      const remainingTime = payload.exp * 1000 - Date.now();
      const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      console.log(`✅ Token is VALID (expires in ${days} days and ${hours} hours)`);
    } else {
      console.log('⚠️ Token has no expiration date');
    }
    
    return decoded;
  } catch (error) {
    console.log('❌ Error decoding token:', error.message);
    return null;
  }
}

// Helper to update .env file with new token
async function updateEnvFile(token) {
  try {
    // Read the current .env file
    let envContent;
    try {
      envContent = await fs.readFile(ENV_PATH, 'utf8');
    } catch (error) {
      // If file doesn't exist, create it
      envContent = '';
    }

    // Check if SURREALDB_TOKEN already exists
    const tokenRegex = /^SURREALDB_TOKEN=.*/m;
    if (tokenRegex.test(envContent)) {
      // Replace existing token
      envContent = envContent.replace(tokenRegex, `SURREALDB_TOKEN=${token}`);
    } else {
      // Add new token
      envContent += `\nSURREALDB_TOKEN=${token}`;
    }

    // Write updated content back to .env file
    await fs.writeFile(ENV_PATH, envContent);
    console.log('✅ Updated .env file with new token');
    
    console.log('\n🔔 IMPORTANT: Remember to update your Vercel environment variables with this token!');
    console.log('   Go to your Vercel project settings > Environment Variables');
    console.log('   Add or update SURREALDB_TOKEN with this value.');
    
    return true;
  } catch (error) {
    console.error('❌ Error updating .env file:', error);
    return false;
  }
}

// Test connection with token
async function testConnection(token) {
  console.log('\n🔌 Testing connection to SurrealDB...');
  
  const db = new Surreal();
  
  try {
    console.log(`Connecting to ${SURREALDB_HOST}...`);
    await db.connect(SURREALDB_HOST);
    console.log('✅ Connected to SurrealDB');
    
    console.log(`Using namespace: ${SURREALDB_NS}, database: ${SURREALDB_DB}...`);
    await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });
    console.log('✅ Namespace and database selected');
    
    console.log('Authenticating with token...');
    await db.authenticate(token);
    console.log('✅ Authentication successful');
    
    // Try a simple query to verify permissions
    console.log('Testing query...');
    const result = await db.query('SELECT count() FROM information_schema.tables');
    console.log('✅ Query successful:', result);
    
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  } finally {
    try {
      await db.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Generate custom JWT token
async function generateCustomToken() {
  console.log('🔑 Generating custom JWT token...');
  
  // Create token payload
  const payload = {
    iss: 'ssc-chatbot',
    ns: SURREALDB_NS,
    db: SURREALDB_DB,
    exp: Math.floor(Date.now() / 1000) + (TOKEN_EXPIRATION_DAYS * 24 * 60 * 60)
  };
  
  try {
    // Sign the token
    const token = jwt.sign(payload, TOKEN_SECRET, { algorithm: 'HS256' });
    console.log('✅ Token generated successfully');
    console.log('\n📋 Your token:');
    console.log(token);
    
    // Decode and display token info
    decodeToken(token);
    
    // Update .env file
    await updateEnvFile(token);
    
    // Test connection
    await testConnection(token);
    
    return token;
  } catch (error) {
    console.error('❌ Error generating token:', error);
    return null;
  }
}

// Main function
async function main() {
  console.log('🔐 SurrealDB Direct Token Generator 🔐');
  console.log('=====================================');
  console.log('Generating a new token with the following settings:');
  console.log(`• Host: ${SURREALDB_HOST}`);
  console.log(`• Namespace: ${SURREALDB_NS}`);
  console.log(`• Database: ${SURREALDB_DB}`);
  console.log(`• Expiration: ${TOKEN_EXPIRATION_DAYS} days`);
  
  await generateCustomToken();
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
