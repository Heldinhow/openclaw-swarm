/**
 * Shared Context Store Module
 * 
 * Provides a mechanism for subagents to share context between siblings.
 * Supports namespaces, TTL-based expiration, and pub/sub for real-time updates.
 */

import { AgentToolResult } from "@mariozechner/pi-agent-core";

export interface StoredValue<T = unknown> {
  value: T;
  expiresAt?: number;
  createdAt: number;
}

export type SubscribeCallback<T = unknown> = (key: string, value: T, action: "set" | "delete") => void;

interface Subscription<T = unknown> {
  callback: SubscribeCallback<T>;
  namespace: string;
  key?: string; // undefined means subscribe to all keys in namespace
}

/**
 * Shared Context Store
 * 
 * In-memory storage with TTL support and pub/sub for cross-agent communication.
 */
export class SharedContextStore {
  private store: Map<string, Map<string, StoredValue>> = new Map();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [namespace, entries] of this.store) {
      for (const [key, stored] of entries) {
        if (stored.expiresAt && stored.expiresAt <= now) {
          entries.delete(key);
          this.notifySubscribers(namespace, key, undefined, "delete");
        }
      }
      // Clean up empty namespaces
      if (entries.size === 0) {
        this.store.delete(namespace);
      }
    }
  }

  /**
   * Generate composite key from namespace and key
   */
  private compositeKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get subscription key for namespace+key
   */
  private subscriptionKey(namespace: string, key?: string): string {
    return key ? `${namespace}:${key}` : namespace;
  }

  /**
   * Notify subscribers about changes
   */
  private notifySubscribers<T>(namespace: string, key: string, value: T | undefined, action: "set" | "delete"): void {
    const subs = this.subscriptions.get(namespace) || [];
    const subsForKey = this.subscriptions.get(this.subscriptionKey(namespace, key)) || [];
    
    const allSubs = [...subs, ...subsForKey];
    
    for (const sub of allSubs) {
      if (sub.key === undefined || sub.key === key) {
        try {
          sub.callback(key, value as any, action);
        } catch (err) {
          console.error(`Error in subscription callback:`, err);
        }
      }
    }
  }

  /**
   * Store a value in the specified namespace and key
   * 
   * @param namespace - The namespace (e.g., sharedKey from spawn)
   * @param key - The key within the namespace
   * @param value - The value to store
   * @param ttl - Optional TTL in milliseconds
   */
  set<T = unknown>(namespace: string, key: string, value: T, ttl?: number): void {
    if (!namespace || !key) {
      throw new Error("namespace and key are required");
    }

    let namespaceMap = this.store.get(namespace);
    if (!namespaceMap) {
      namespaceMap = new Map();
      this.store.set(namespace, namespaceMap);
    }

    const expiresAt = ttl ? Date.now() + ttl : undefined;
    
    namespaceMap.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    this.notifySubscribers(namespace, key, value, "set");
  }

  /**
   * Get a value from the store
   * 
   * @param namespace - The namespace
   * @param key - The key within the namespace
   * @returns The stored value or undefined if not found/expired
   */
  get<T = unknown>(namespace: string, key: string): T | undefined {
    const namespaceMap = this.store.get(namespace);
    if (!namespaceMap) {
      return undefined;
    }

    const stored = namespaceMap.get(key);
    if (!stored) {
      return undefined;
    }

    // Check if expired
    if (stored.expiresAt && stored.expiresAt <= Date.now()) {
      namespaceMap.delete(key);
      this.notifySubscribers(namespace, key, undefined, "delete");
      return undefined;
    }

    return stored.value as T;
  }

  /**
   * Delete a value from the store
   * 
   * @param namespace - The namespace
   * @param key - The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(namespace: string, key: string): boolean {
    const namespaceMap = this.store.get(namespace);
    if (!namespaceMap) {
      return false;
    }

    const existed = namespaceMap.delete(key);
    if (existed) {
      this.notifySubscribers(namespace, key, undefined, "delete");
    }

    // Clean up empty namespace
    if (namespaceMap.size === 0) {
      this.store.delete(namespace);
    }

    return existed;
  }

  /**
   * List all keys in a namespace
   * 
   * @param namespace - The namespace to list
   * @returns Array of keys (only non-expired ones)
   */
  list(namespace: string): string[] {
    const namespaceMap = this.store.get(namespace);
    if (!namespaceMap) {
      return [];
    }

    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, stored] of namespaceMap) {
      if (stored.expiresAt && stored.expiresAt <= now) {
        namespaceMap.delete(key);
        this.notifySubscribers(namespace, key, undefined, "delete");
      } else {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Subscribe to changes in a namespace or key
   * 
   * @param namespace - The namespace to subscribe to
   * @param key - Optional key to subscribe to (subscribes to all keys if undefined)
   * @param callback - Function called on changes
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(
    namespace: string, 
    key: string | undefined, 
    callback: SubscribeCallback<T>
  ): () => void {
    if (!namespace) {
      throw new Error("namespace is required");
    }

    const keyStr = key ?? undefined;
    const subKey = this.subscriptionKey(namespace, keyStr);
    
    let subs = this.subscriptions.get(subKey) as Subscription<unknown>[] | undefined;
    if (!subs) {
      subs = [];
      this.subscriptions.set(subKey, subs);
    }

    const subscription: Subscription<T> = {
      callback,
      namespace,
      key: keyStr,
    };

    subs.push(subscription as Subscription<unknown>);

    // Return unsubscribe function
    return () => {
      const idx = subs.indexOf(subscription as Subscription<unknown>);
      if (idx >= 0) {
        subs.splice(idx, 1);
      }
      if (subs.length === 0) {
        this.subscriptions.delete(subKey);
      }
    };
  }

  /**
   * Broadcast a message to all subscribers in a namespace
   * 
   * @param namespace - The namespace to broadcast to
   * @param message - The message to broadcast
   */
  broadcast(namespace: string, message: unknown): void {
    const subs = this.subscriptions.get(namespace) || [];
    
    for (const sub of subs) {
      try {
        // Broadcast to all keys in namespace
        sub.callback("*", message as any, "set");
      } catch (err) {
        console.error(`Error in broadcast callback:`, err);
      }
    }
  }

  /**
   * Get all namespaces
   */
  namespaces(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.store.clear();
    this.subscriptions.clear();
  }

  /**
   * Destroy the store (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
let sharedContextStoreInstance: SharedContextStore | null = null;

/**
 * Get the singleton SharedContextStore instance
 */
export function getSharedContextStore(): SharedContextStore {
  if (!sharedContextStoreInstance) {
    sharedContextStoreInstance = new SharedContextStore();
  }
  return sharedContextStoreInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSharedContextStore(): void {
  if (sharedContextStoreInstance) {
    sharedContextStoreInstance.destroy();
    sharedContextStoreInstance = null;
  }
}
