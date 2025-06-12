// Script to update the SURREALDB_TOKEN in the .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for the token
rl.question('Paste your new long-lived token here: ', (token) => {
  // Path to the .env file
  const envPath = path.join(__dirname, '..', '.env');

  try {
    // Check if .env file exists
    if (fs.existsSync(envPath)) {
      // Read the current content
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if SURREALDB_TOKEN already exists
      if (envContent.includes('SURREALDB_TOKEN=')) {
        // Replace the existing token
        envContent = envContent.replace(/SURREALDB_TOKEN=.*(\r?\n|$)/g, `SURREALDB_TOKEN=${token}$1`);
        console.log('Replaced existing SURREALDB_TOKEN in .env file');
      } else {
        // Add the token as a new line
        envContent += `\nSURREALDB_TOKEN=${token}\n`;
        console.log('Added SURREALDB_TOKEN to .env file');
      }
      
      // Write the updated content back to the file
      fs.writeFileSync(envPath, envContent);
      console.log('Successfully updated .env file');
    } else {
      // Create a new .env file with the token
      fs.writeFileSync(envPath, `SURREALDB_TOKEN=${token}\n`);
      console.log('Created new .env file with SURREALDB_TOKEN');
    }
    
    console.log('\nIMPORTANT: Add this token to your Vercel environment variables:');
    console.log(`SURREALDB_TOKEN=${token}`);
  } catch (error) {
    console.error('Error updating .env file:', error);
  } finally {
    rl.close();
  }
});
