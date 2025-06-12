// Script to generate a SurrealDB token using the CLI
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const SURREALDB_HOST = process.env.SURREALDB_HOST || 'wss://scraper-06bhh0a1qlrmvdad4lrmheafb0.aws-euw1.surreal.cloud';
const SURREALDB_NS = process.env.SURREALDB_NS || 'chatbot_knowledge';
const SURREALDB_DB = process.env.SURREALDB_DB || 'scraper';

// Generate a token using the SurrealDB CLI
console.log('Generating a new SurrealDB token with 1 year expiration...');
console.log('This will open a new SurrealDB CLI session.');
console.log('Please follow these steps:');
console.log('1. When the SurrealDB CLI opens, run these commands:');
console.log(`   USE NS ${SURREALDB_NS} DB ${SURREALDB_DB};`);
console.log('   DEFINE TOKEN api_token ON DATABASE TYPE HS512 VALUE "ssc_chatbot_secret_key";');
console.log('2. Copy the token that is generated');
console.log('3. Press Ctrl+C to exit the CLI');
console.log('4. Paste the token when prompted by this script');
console.log('\nPress Enter to continue...');

// Wait for user to press Enter
process.stdin.once('data', () => {
  // Open the SurrealDB CLI
  const cliCommand = `surreal sql --endpoint ${SURREALDB_HOST}`;
  
  console.log(`\nRunning: ${cliCommand}`);
  console.log('Please authenticate with your credentials when prompted...\n');
  
  const cli = exec(cliCommand);
  
  // Forward stdout and stderr to the console
  cli.stdout.pipe(process.stdout);
  cli.stderr.pipe(process.stderr);
  
  // When the CLI exits, prompt for the token
  cli.on('exit', () => {
    console.log('\n\nPlease paste the token you generated:');
    process.stdin.once('data', (tokenInput) => {
      const token = tokenInput.toString().trim();
      
      if (!token) {
        console.log('No token provided. Exiting...');
        process.exit(1);
      }
      
      // Save the token to the .env file
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
      console.log('\nIMPORTANT: Add this token to your Vercel environment variables:');
      console.log(`SURREALDB_TOKEN=${token}`);
      
      // Test the token
      console.log('\nTesting the token...');
      const testScript = path.join(__dirname, 'test-connection.js');
      exec(`node ${testScript}`, (error, stdout, stderr) => {
        console.log(stdout);
        if (stderr) {
          console.error(stderr);
        }
      });
    });
  });
});
