#!/usr/bin/env node
/**
 * SurrealDB Token Wizard
 * 
 * This script helps you generate and test SurrealDB tokens for your application.
 * It provides multiple methods to create tokens and updates your .env file.
 */

import { Surreal } from 'surrealdb';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

// Get environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
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
      return null;
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

// Method 1: Generate custom JWT token
async function generateCustomToken() {
  console.log('\n🔑 Generating custom JWT token...');
  
  // Ask for token secret
  const secret = await question('Enter a secret key for token signing (or press Enter for default): ');
  const tokenSecret = secret || 'ssc_chatbot_secret_key';
  
  // Ask for token expiration
  const expInput = await question('Enter token expiration in days (or press Enter for 365 days): ');
  const expDays = parseInt(expInput) || 365;
  
  // Create token payload
  const payload = {
    iss: 'ssc-chatbot',
    ns: SURREALDB_NS,
    db: SURREALDB_DB,
    exp: Math.floor(Date.now() / 1000) + (expDays * 24 * 60 * 60)
  };
  
  try {
    // Sign the token
    const token = jwt.sign(payload, tokenSecret, { algorithm: 'HS256' });
    console.log('✅ Token generated successfully');
    console.log('\n📋 Your token:');
    console.log(token);
    
    // Decode and display token info
    decodeToken(token);
    
    // Update .env file
    const updateEnv = await question('\nDo you want to update your .env file with this token? (y/n): ');
    if (updateEnv.toLowerCase() === 'y') {
      await updateEnvFile(token);
    }
    
    // Test connection
    const testConn = await question('Do you want to test the connection with this token? (y/n): ');
    if (testConn.toLowerCase() === 'y') {
      await testConnection(token);
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error generating token:', error);
    return null;
  }
}

// Method 2: Paste existing token
async function pasteExistingToken() {
  console.log('\n📋 Paste your existing SurrealDB token...');
  const token = await question('Token: ');
  
  if (!token) {
    console.log('❌ No token provided');
    return null;
  }
  
  // Decode and display token info
  const decoded = decodeToken(token);
  if (!decoded) {
    console.log('⚠️ Token could not be decoded, but we will continue anyway');
  }
  
  // Update .env file
  const updateEnv = await question('\nDo you want to update your .env file with this token? (y/n): ');
  if (updateEnv.toLowerCase() === 'y') {
    await updateEnvFile(token);
  }
  
  // Test connection
  const testConn = await question('Do you want to test the connection with this token? (y/n): ');
  if (testConn.toLowerCase() === 'y') {
    await testConnection(token);
  }
  
  return token;
}

// Method 3: Generate token using SurrealDB CLI
async function generateTokenWithCLI() {
  console.log('\n🔧 Generating token using SurrealDB CLI...');
  console.log('Make sure you have the SurrealDB CLI installed and accessible in your PATH');
  
  const proceed = await question('Do you want to proceed? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    return null;
  }
  
  try {
    // Check if SurrealDB CLI is installed
    try {
      execSync('surreal --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ SurrealDB CLI not found. Please install it first.');
      return null;
    }
    
    // Ask for token name
    const tokenName = await question('Enter a name for your token (default: ssc_token): ');
    const name = tokenName || 'ssc_token';
    
    // Ask for token expiration
    const expInput = await question('Enter token expiration in days (default: 365): ');
    const expDays = parseInt(expInput) || 365;
    
    console.log('\n📝 Follow these steps in the SurrealDB CLI:');
    console.log(`1. Connect to your database: surreal sql --endpoint ${SURREALDB_HOST} --user ${SURREALDB_USER || 'your_username'} --pass ${SURREALDB_PASS || 'your_password'}`);
    console.log(`2. Select namespace and database: USE NS ${SURREALDB_NS} DB ${SURREALDB_DB};`);
    console.log(`3. Define your token: DEFINE TOKEN ${name} ON DATABASE TYPE HS512 VALUE "your_secret_key" DURATION ${expDays}d;`);
    console.log('4. Exit the CLI with Ctrl+D or by typing "exit"');
    
    console.log('\nAfter generating the token, copy it and paste it here:');
    const token = await question('Token: ');
    
    if (!token) {
      console.log('❌ No token provided');
      return null;
    }
    
    // Decode and display token info
    decodeToken(token);
    
    // Update .env file
    const updateEnv = await question('\nDo you want to update your .env file with this token? (y/n): ');
    if (updateEnv.toLowerCase() === 'y') {
      await updateEnvFile(token);
    }
    
    // Test connection
    const testConn = await question('Do you want to test the connection with this token? (y/n): ');
    if (testConn.toLowerCase() === 'y') {
      await testConnection(token);
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error generating token with CLI:', error);
    return null;
  }
}

// Main function
async function main() {
  console.log('🧙‍♂️ SurrealDB Token Wizard 🧙‍♂️');
  console.log('================================');
  console.log('This wizard will help you generate and test SurrealDB tokens');
  console.log('for your Salish Sea Consulting chatbot application.');
  console.log('\nCurrent configuration:');
  console.log(`• Host: ${SURREALDB_HOST}`);
  console.log(`• Namespace: ${SURREALDB_NS}`);
  console.log(`• Database: ${SURREALDB_DB}`);
  console.log(`• Username: ${SURREALDB_USER || '[not set]'}`);
  console.log(`• Password: ${SURREALDB_PASS ? '[set]' : '[not set]'}`);
  
  if (process.env.SURREALDB_TOKEN) {
    console.log('\nExisting token found in environment variables:');
    decodeToken(process.env.SURREALDB_TOKEN);
  }
  
  while (true) {
    console.log('\nChoose a method to get a SurrealDB token:');
    console.log('1. Generate custom JWT token');
    console.log('2. Paste existing token');
    console.log('3. Generate token using SurrealDB CLI');
    console.log('4. Exit');
    
    const choice = await question('\nEnter your choice (1-4): ');
    
    switch (choice) {
      case '1':
        await generateCustomToken();
        break;
      case '2':
        await pasteExistingToken();
        break;
      case '3':
        await generateTokenWithCLI();
        break;
      case '4':
        console.log('\n👋 Exiting SurrealDB Token Wizard. Goodbye!');
        rl.close();
        return;
      default:
        console.log('❌ Invalid choice. Please try again.');
    }
    
    const another = await question('\nDo you want to try another method? (y/n): ');
    if (another.toLowerCase() !== 'y') {
      console.log('\n👋 Exiting SurrealDB Token Wizard. Goodbye!');
      rl.close();
      return;
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
