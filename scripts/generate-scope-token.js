// Script to generate a scoped token for SurrealDB using the REST API
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
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Convert WebSocket URL to HTTP URL for REST API
const getRestUrl = (wsUrl) => {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
};

async function generateScopedToken() {
  try {
    // Get the token from the environment that you used to authenticate with the CLI
    const authToken = process.env.SURREALDB_TOKEN;
    
    if (!authToken) {
      console.error('No authentication token found in .env file');
      return;
    }
    
    // Convert WebSocket URL to REST URL
    const restUrl = getRestUrl(SURREALDB_HOST);
    const tokenUrl = `${restUrl}/key`;
    
    console.log(`Attempting to generate a scoped token from: ${tokenUrl}`);
    
    // Define the scope for the new token
    const scope = {
      // Set the namespace and database
      namespace: SURREALDB_NS,
      database: SURREALDB_DB,
      
      // Set the scope (what operations are allowed)
      scope: 'full', // 'full' gives all permissions
      
      // Set the expiration (1 year)
      expiry: '8760h'
    };
    
    // Make the request to generate a scoped token
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(scope)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate token: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    const newToken = data.token || data.jwt || data;
    
    console.log('Successfully generated scoped token!');
    
    // Save token to .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('SURREALDB_TOKEN=')) {
        envContent = envContent.replace(/SURREALDB_TOKEN=.*(\r?\n|$)/g, `SURREALDB_TOKEN=${newToken}$1`);
      } else {
        envContent += `\nSURREALDB_TOKEN=${newToken}\n`;
      }
    } else {
      envContent = `SURREALDB_TOKEN=${newToken}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('\nToken saved to .env file');
    console.log('\nAdd this token to your Vercel environment variables:');
    console.log(`SURREALDB_TOKEN=${newToken}`);
    
    return newToken;
  } catch (error) {
    console.error('Error generating token:', error);
    return null;
  }
}

// Run the function
generateScopedToken();
