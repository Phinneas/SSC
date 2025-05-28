
import { Mastra } from '@mastra/core';

import { LangfuseExporter } from 'langfuse-vercel';
import { salishSeaChatbot } from './agents/salishSeaChatbot'; // Import from the correct relative path

export const mastra = new Mastra({
  agents: {
    salishSeaChatbot, // Register your main chatbot agent
  },
  telemetry: {
    serviceName: 'my-nursery-chatbot-railway-demo', // Your unique service name for Langfuse
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
    port: parseInt(process.env.PORT || '4111', 10), // Ensures it uses Railway's assigned PORT
  },
});