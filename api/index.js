// This file is used by Vercel to create serverless functions

// Import the Mastra instance
import { mastra } from '../src/mastra/index.js';

// Create a request handler for Vercel
export default async function handler(req, res) {
  // Parse the URL to get the path
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (for CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Root path - show a simple HTML page
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <html>
        <head>
          <title>Salish Sea Consulting Chatbot</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
            h1 { color: #0070f3; }
            a { color: #0070f3; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>Salish Sea Consulting Chatbot</h1>
          <p>The chatbot API is available at <a href="/agents/salishSeaChatbot">/agents/salishSeaChatbot</a></p>
        </body>
      </html>
    `);
    return;
  }

  // Forward all other requests to the Mastra server
  try {
    // Create a fetch Request object from the incoming request
    const fetchRequest = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Process the request with Mastra
    const response = await mastra.server.fetch(fetchRequest);
    
    // Extract status, headers, and body from the response
    const status = response.status;
    const headers = Object.fromEntries(response.headers.entries());
    const body = await response.text();
    
    // Set headers on the response
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Send the response
    res.status(status).send(body);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
