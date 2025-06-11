
import { Mastra } from '@mastra/core';
import { VercelDeployer } from '@mastra/deployer-vercel';
import { LangfuseExporter } from 'langfuse-vercel';
import { salishSeaChatbot } from './agents/salishSeaChatbot'; // Import from the correct relative path

// Create the Mastra instance
export const mastra = new Mastra({
  agents: {
    salishSeaChatbot, // Register your main chatbot agent
  },
  telemetry: {
    serviceName: 'salish-sea-consulting-chatbot', // Your unique service name for Langfuse
    enabled: true,
    export: {
      type: 'custom',
      exporter: new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
        secretKey: process.env.LANGFUSE_SECRET_KEY!,
        baseUrl: process.env.LANGFUSE_HOST!, // Uses the host from your .env.local/Railway env vars
      }),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '4112', 10), // Keep this for local dev, Vercel uses its own PORT
    host: '0.0.0.0', // added this line
  },
  deployer: new VercelDeployer({
    projectName: 'ssc-chatbot', // This should match your Vercel project name
    teamSlug: process.env.VERCEL_TEAM_SLUG || '', // Optional: Your Vercel team slug if using teams
    token: process.env.VERCEL_TOKEN || '', // Will use from environment variables if available
  }),
});