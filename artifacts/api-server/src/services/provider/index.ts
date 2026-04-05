export * from "./types.js";
export * from "./mock-provider.js";
export * from "./green-api-provider.js";
export * from "./evolution-api-provider.js";

import type { ProviderInterface } from "./types.js";
import { mockProvider } from "./mock-provider.js";
import { greenApiProvider } from "./green-api-provider.js";
import { evolutionApiProvider } from "./evolution-api-provider.js";

export function getProvider(providerName: string): ProviderInterface {
  switch (providerName) {
    case "green-api":
      return greenApiProvider;
    case "evolution-api":
      return evolutionApiProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

export function isProviderConfigured(providerName: string): { configured: boolean; error?: string } {
  switch (providerName) {
    case "green-api":
      if (!process.env.GREEN_API_INSTANCE_ID || !process.env.GREEN_API_TOKEN) {
        return { 
          configured: false, 
          error: "Green API requires GREEN_API_INSTANCE_ID and GREEN_API_TOKEN environment variables" 
        };
      }
      return { configured: true };
    
    case "evolution-api":
      if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_API_INSTANCE) {
        return { 
          configured: false, 
          error: "Evolution API requires EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_API_INSTANCE environment variables" 
        };
      }
      return { configured: true };
    
    case "mock":
      return { configured: true };
    
    default:
      return { configured: false, error: `Unknown provider: ${providerName}` };
  }
}
