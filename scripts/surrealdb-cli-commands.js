#!/usr/bin/env node
/**
 * SurrealDB CLI Command Generator
 * 
 * This script generates the correct SurrealDB CLI commands to create and retrieve a token.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_USER = process.env.SURREALDB_USER;
const SURREALDB_PASS = process.env.SURREALDB_PASS;
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Generate a random token name to avoid conflicts
const tokenName = `ssc_token_${Math.floor(Math.random() * 10000)}`;

console.log('🔐 SurrealDB CLI Command Generator 🔐');
console.log('===================================');
console.log('Copy and run these commands in your SurrealDB CLI:');
console.log('\n1. Connect to SurrealDB:');

if (SURREALDB_USER && SURREALDB_PASS) {
  console.log(`surreal sql --endpoint ${SURREALDB_HOST} --user ${SURREALDB_USER} --pass ${SURREALDB_PASS}`);
} else {
  console.log(`surreal sql --endpoint ${SURREALDB_HOST}`);
  console.log('(You may need to provide username and password when prompted)');
}

console.log('\n2. Select namespace and database:');
console.log(`USE NS ${SURREALDB_NS} DB ${SURREALDB_DB};`);

console.log('\n3. Define a token:');
console.log(`DEFINE TOKEN ${tokenName} ON DATABASE`);
console.log(`TYPE HS512`);
console.log(`VALUE "ssc_chatbot_secret_key"`);
console.log(`DURATION 365d;`);

console.log('\n4. Retrieve the token:');
console.log(`INFO FOR TOKEN ${tokenName} ON DATABASE;`);

console.log('\n5. After you get the token, save it to your .env file using:');
console.log(`node scripts/update-env-with-new-token.js`);

console.log('\n6. Test the connection with your new token:');
console.log(`node scripts/test-connection.js`);

console.log('\nNOTE: If you get a parse error with the INFO command, try:');
console.log(`RETURN SELECT VALUE FROM scope:token WHERE name = '${tokenName}';`);
