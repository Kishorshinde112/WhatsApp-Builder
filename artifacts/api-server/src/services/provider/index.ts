export * from "./types.js";
export * from "./mock-provider.js";

import type { ProviderInterface } from "./types.js";
import { mockProvider } from "./mock-provider.js";

export function getProvider(providerName: string): ProviderInterface {
  switch (providerName) {
    case "green-api":
    case "evolution-api":
      return mockProvider;
    case "mock":
    default:
      return mockProvider;
  }
}
