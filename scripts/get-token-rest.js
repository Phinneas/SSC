// Script to get a SurrealDB token using the REST API
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Convert WebSocket URL to HTTP URL for REST API
const getRestUrl = (wsUrl) => {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
};

async function getToken() {
  try {
    // Prompt for credentials if not in environment
    const username = SURREALDB_USER || await promptForInput('Enter your SurrealDB username: ');
    const password = SURREALDB_PASS || await promptForInput('Enter your SurrealDB password: ');
    
    // Convert WebSocket URL to REST URL
    const restUrl = getRestUrl(SURREALDB_HOST);
    const signinUrl = `${restUrl}/signin`;
    
    console.log(`Attempting to get token from: ${signinUrl}`);
    
    // Make signin request
    const response = await fetch(signinUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        namespace: SURREALDB_NS,
        database: SURREALDB_DB
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    console.log('Successfully obtained token!');
    
    // Save token to .env file
    const token = data.token;
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('SURREALDB_TOKEN=')) {
        envContent = envContent.replace(/SURREALDB_TOKEN=.*(\r?\n|$)/g, `SURREALDB_TOKEN=${token}$1`);
      } else {
        envContent += `\nSURREALDB_TOKEN=${token}\n`;
      }
    } else {
      envContent = `SURREALDB_TOKEN=${token}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('\nToken saved to .env file');
    console.log('\nAdd this token to your Vercel environment variables:');
    console.log(`SURREALDB_TOKEN=${token}`);
    
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
}

// Simple function to prompt for input
async function promptForInput(prompt) {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Run the function
getToken();
