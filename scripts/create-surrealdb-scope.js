#!/usr/bin/env node
/**
 * SurrealDB Scope Creator
 * 
 * This script creates a SurrealDB scope and user with appropriate permissions
 * for the chatbot to access the database.
 */

import { Surreal } from 'surrealdb';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

// Get environment variables
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_USER = process.env.SURREALDB_USER || 'root';
const SURREALDB_PASS = process.env.SURREALDB_PASS || 'root';
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to ask questions
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Helper to update .env file with new credentials
async function updateEnvFile(key, value) {
  try {
    // Read the current .env file
    let envContent;
    try {
      envContent = await fs.readFile(ENV_PATH, 'utf8');
    } catch (error) {
      // If file doesn't exist, create it
      envContent = '';
    }

    // Check if key already exists
    const keyRegex = new RegExp(`^${key}=.*`, 'm');
    if (keyRegex.test(envContent)) {
      // Replace existing value
      envContent = envContent.replace(keyRegex, `${key}=${value}`);
    } else {
      // Add new key-value pair
      envContent += `\n${key}=${value}`;
    }

    // Write updated content back to .env file
    await fs.writeFile(ENV_PATH, envContent);
    console.log(`✅ Updated .env file with new ${key}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating .env file for ${key}:`, error);
    return false;
  }
}

// Main function
async function main() {
  console.log('🔐 SurrealDB Scope Creator 🔐');
  console.log('============================');
  console.log('This script will create a SurrealDB scope and user with appropriate permissions');
  console.log('for your chatbot to access the database.');
  
  console.log('\nCurrent configuration:');
  console.log(`• Host: ${SURREALDB_HOST}`);
  console.log(`• Namespace: ${SURREALDB_NS}`);
  console.log(`• Database: ${SURREALDB_DB}`);
  console.log(`• Admin Username: ${SURREALDB_USER}`);
  console.log(`• Admin Password: ${SURREALDB_PASS ? '[set]' : '[not set]'}`);
  
  // Ask for admin credentials if not set
  let adminUser = SURREALDB_USER;
  let adminPass = SURREALDB_PASS;
  
  if (!adminUser || adminUser === 'root') {
    adminUser = await question('\nEnter admin username (default: root): ') || 'root';
  }
  
  if (!adminPass) {
    adminPass = await question('Enter admin password: ');
    if (!adminPass) {
      console.error('❌ Admin password is required');
      rl.close();
      return;
    }
  }
  
  // Ask for chatbot user credentials
  const chatbotUser = await question('\nEnter chatbot username (default: chatbot): ') || 'chatbot';
  const chatbotPass = await question('Enter chatbot password (default: chatbot_password): ') || 'chatbot_password';
  
  console.log('\n🔄 Connecting to SurrealDB...');
  
  const db = new Surreal();
  
  try {
    // Connect to SurrealDB
    await db.connect(SURREALDB_HOST);
    console.log('✅ Connected to SurrealDB');
    
    // Sign in as admin
    console.log(`🔄 Signing in as ${adminUser}...`);
    await db.signin({
      username: adminUser,
      password: adminPass,
    });
    console.log('✅ Signed in successfully');
    
    // Use the specified namespace and database
    console.log(`🔄 Using namespace: ${SURREALDB_NS}, database: ${SURREALDB_DB}...`);
    await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });
    console.log('✅ Namespace and database selected');
    
    // Create a scope for the chatbot
    console.log('\n🔄 Creating scope for chatbot...');
    const scopeName = 'chatbot_scope';
    
    // Define the scope with appropriate permissions
    const scopeQuery = `
      DEFINE SCOPE ${scopeName}
        SESSION 24h
        SIGNUP ( CREATE user SET email = $email, pass = crypto::argon2::generate($pass) )
        SIGNIN ( SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(pass, $pass) );
    `;
    
    await db.query(scopeQuery);
    console.log(`✅ Created scope: ${scopeName}`);
    
    // Create a token for the chatbot
    console.log('\n🔄 Creating token for chatbot...');
    const tokenName = 'chatbot_token';
    
    // Define the token with appropriate permissions
    const tokenQuery = `
      DEFINE TOKEN ${tokenName} ON DATABASE
        TYPE HS512
        VALUE "ssc_chatbot_secret_key"
        DURATION 365d;
    `;
    
    await db.query(tokenQuery);
    console.log(`✅ Created token: ${tokenName}`);
    
    // Get the token value
    console.log('\n🔄 Retrieving token...');
    let tokenValue;
    try {
      const tokenResult = await db.query(`INFO FOR TOKEN ${tokenName} ON DATABASE;`);
      console.log('Token info:', tokenResult);
      
      // Extract token from result
      if (tokenResult && tokenResult[0] && tokenResult[0].result) {
        tokenValue = tokenResult[0].result;
        console.log(`✅ Retrieved token: ${tokenValue}`);
      } else {
        console.warn('⚠️ Could not extract token value from result');
      }
    } catch (tokenError) {
      console.error('❌ Error retrieving token:', tokenError.message);
      
      // Try alternative method
      try {
        const altTokenResult = await db.query(`RETURN SELECT VALUE FROM scope:token WHERE name = '${tokenName}';`);
        console.log('Alternative token query result:', altTokenResult);
        
        // Extract token from alternative result
        if (altTokenResult && altTokenResult[0] && altTokenResult[0].result) {
          tokenValue = altTokenResult[0].result;
          console.log(`✅ Retrieved token using alternative method: ${tokenValue}`);
        } else {
          console.warn('⚠️ Could not extract token value from alternative result');
        }
      } catch (altTokenError) {
        console.error('❌ Error retrieving token using alternative method:', altTokenError.message);
      }
    }
    
    // Create a user for the chatbot
    console.log('\n🔄 Creating user for chatbot...');
    
    // Define the user with appropriate permissions
    const userQuery = `
      DEFINE USER ${chatbotUser} PASSWORD '${chatbotPass}'
        ROLES VIEWER, EDITOR;
    `;
    
    await db.query(userQuery);
    console.log(`✅ Created user: ${chatbotUser}`);
    
    // Update .env file with new credentials
    if (tokenValue) {
      await updateEnvFile('SURREALDB_TOKEN', tokenValue);
    }
    
    await updateEnvFile('SURREALDB_USER', chatbotUser);
    await updateEnvFile('SURREALDB_PASS', chatbotPass);
    
    console.log('\n✅ Setup completed successfully');
    console.log('\n🔔 IMPORTANT: Remember to update your Vercel environment variables with these values!');
    console.log('   Go to your Vercel project settings > Environment Variables');
    console.log('   Add or update the following variables:');
    console.log(`   • SURREALDB_HOST: ${SURREALDB_HOST}`);
    console.log(`   • SURREALDB_NS: ${SURREALDB_NS}`);
    console.log(`   • SURREALDB_DB: ${SURREALDB_DB}`);
    console.log(`   • SURREALDB_USER: ${chatbotUser}`);
    console.log(`   • SURREALDB_PASS: ${chatbotPass}`);
    if (tokenValue) {
      console.log(`   • SURREALDB_TOKEN: ${tokenValue}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    try {
      await db.close();
    } catch (e) {
      // Ignore close errors
    }
    rl.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
