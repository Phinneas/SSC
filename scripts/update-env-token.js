// Script to update the SURREALDB_TOKEN in the .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The token from your successful connection
const token = 'eyJhbGciOiJQUzI1NiIsImtpZCI6IjFkNmViYjAyLWM5ZjEtNDg4Zi1iNjhjLWNlMzMzMzU4YzgyOCIsInR5cCI6IkpXVCJ9.eyJhYyI6ImNsb3VkIiwiYXVkIjoiMDZiaGgwYTFxbHJtdmRhZDRscm1oZWFmYjAiLCJleHAiOjE3NDk2ODcwNDksImlhdCI6MTc0OTY4Njk4OSwicmwiOlsiT3duZXIiXX0.AJW1etVpz1jY7JXF5DHxONJ3k_MLYMM5kQWbzF771p7qpU8fD3MGvpf45DtXut8YSrN8vqDT1MJXGLXFa0C47wSGYjIR_fq_U245ZiFMfgvTVcDHwzZDwbgyVe8jjHd9yPWUgxkttbTIFdDb8rEeZETijozmmnkxRAsIyZL6YD4CFwQpPYFx4kWvBColryu6hNo-Aj7_6y7FxNqcCXpKIq2iZ6fkKC2biYV9L4sF82CgYjcg8uYVCgP2u9hhNA0xA0RrMH6iEIfuhzv2VKAAST0fdRAhjmrRvQL7kQgRqbyxEFG2fxQl23a23d7oD91pUH0Dm-5WNw22i6roqQy7AA';

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
  console.log('\nNote: This token expires on ' + new Date(1749687049 * 1000).toLocaleString());
} catch (error) {
  console.error('Error updating .env file:', error);
}
