import type { AppConfig } from "../config";
import { MemoryStore } from "./memoryStore";
import { PgStore } from "./pgStore";
import type { Store } from "./store";

export function createStore(appConfig: AppConfig): Store {
  return appConfig.databaseUrl ? new PgStore(appConfig) : new MemoryStore();
}

export { MemoryStore };
export type { Store };
