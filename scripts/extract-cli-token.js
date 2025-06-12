#!/usr/bin/env node
/**
 * SurrealDB CLI Token Extractor
 * 
 * This script helps extract and save a token from the SurrealDB CLI output.
 * It provides instructions on how to generate a token using the CLI and then
 * helps you extract and save it to your .env file.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

// Get environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to ask questions
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

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

// Extract token from CLI output
function extractToken(output) {
  // Try to find JWT token pattern (base64url encoded segments separated by dots)
  const jwtPattern = /ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  const match = output.match(jwtPattern);
  
  if (match) {
    return match[0];
  }
  
  return null;
}

// Main function
async function main() {
  console.log('🔍 SurrealDB CLI Token Extractor 🔍');
  console.log('==================================');
  console.log('This tool will help you extract a token from the SurrealDB CLI output');
  console.log('and save it to your .env file.');
  
  console.log('\n📝 Follow these steps in the SurrealDB CLI:');
  console.log(`1. Connect to your database using this command:`);
  console.log(`   surreal sql --endpoint ${SURREALDB_HOST}`);
  console.log(`2. Select namespace and database:`);
  console.log(`   USE NS ${SURREALDB_NS} DB ${SURREALDB_DB};`);
  console.log(`3. Define a token with these commands:`);
  console.log(`   DEFINE TOKEN api_token ON DATABASE`);
  console.log(`   TYPE HS512`);
  console.log(`   VALUE "your_secret_key"`);
  console.log(`   DURATION 365d;`);
  console.log(`4. Then run:`);
  console.log(`   RETURN SELECT VALUE FROM access WHERE access = 'api_token';`);
  console.log(`5. Copy the ENTIRE output from the CLI and paste it below.`);
  
  const cliOutput = await question('\nPaste the CLI output here: ');
  
  if (!cliOutput) {
    console.log('❌ No output provided');
    rl.close();
    return;
  }
  
  // Try to extract token from CLI output
  const token = extractToken(cliOutput);
  
  if (!token) {
    console.log('❌ Could not find a token in the provided output');
    console.log('Please make sure you copied the entire CLI output');
    rl.close();
    return;
  }
  
  console.log('✅ Token extracted successfully');
  console.log('\n📋 Your token:');
  console.log(token);
  
  // Decode and display token info
  decodeToken(token);
  
  // Update .env file
  const updateEnv = await question('\nDo you want to update your .env file with this token? (y/n): ');
  if (updateEnv.toLowerCase() === 'y') {
    await updateEnvFile(token);
  }
  
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
