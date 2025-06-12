// Script to generate a custom SurrealDB token with the correct audience claim
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a token with the correct audience claim
function generateToken() {
  // Secret key for signing the token (use a strong random value in production)
  const secretKey = 'ssc_chatbot_secret_key';
  
  // Token payload
  const payload = {
    // Database instance ID from your validation rule
    aud: '06bhh0a1qlrmvdad4lrmheafb0',
    
    // Add other claims as needed
    iss: 'ssc-chatbot',
    
    // Set appropriate permissions
    // These are example permissions - adjust as needed for your database
    db: 'scraper',
    ns: 'chatbot_knowledge',
    
    // Permissions
    sc: 'full' // 'full' gives all permissions, or you can specify individual permissions
  };
  
  // Token options
  const options = {
    expiresIn: '8760h', // 1 year
    algorithm: 'HS512'
  };
  
  // Generate the token
  const token = jwt.sign(payload, secretKey, options);
  
  console.log('Generated token:');
  console.log(token);
  
  // Save to .env file
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace existing token or add a new one
      if (envContent.includes('SURREALDB_TOKEN=')) {
        envContent = envContent.replace(/SURREALDB_TOKEN=.*(\r?\n|$)/g, `SURREALDB_TOKEN=${token}$1`);
      } else {
        envContent += `\nSURREALDB_TOKEN=${token}\n`;
      }
    } else {
      envContent = `SURREALDB_TOKEN=${token}\n`;
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    console.log('\nToken saved to .env file');
    
    // Instructions for Vercel
    console.log('\nAdd this token to your Vercel environment variables:');
    console.log('SURREALDB_TOKEN=' + token);
  } catch (error) {
    console.error('Error saving token to .env file:', error);
  }
}

// Run the function
generateToken();
