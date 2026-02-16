import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SharedContextStore,
  getSharedContextStore,
  resetSharedContextStore,
} from "./shared-context-store.js";

describe("SharedContextStore", () => {
  let store: SharedContextStore;

  beforeEach(() => {
    // Reset to get a fresh instance for each test
    resetSharedContextStore();
    store = getSharedContextStore();
  });

  afterEach(() => {
    resetSharedContextStore();
  });

  describe("set and get", () => {
    it("should store and retrieve a value", () => {
      store.set("ns1", "key1", { foo: "bar" });
      const result = store.get("ns1", "key1");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return undefined for non-existent key", () => {
      const result = store.get("ns1", "nonexistent");
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-existent namespace", () => {
      const result = store.get("nonexistent-ns", "key1");
      expect(result).toBeUndefined();
    });

    it("should overwrite existing value", () => {
      store.set("ns1", "key1", "first");
      store.set("ns1", "key1", "second");
      const result = store.get("ns1", "key1");
      expect(result).toBe("second");
    });
  });

  describe("TTL", () => {
    it("should expire values after TTL", async () => {
      store.set("ns1", "key1", "value", 10); // 10ms TTL
      expect(store.get("ns1", "key1")).toBe("value");
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));
      
      expect(store.get("ns1", "key1")).toBeUndefined();
    });

    it("should store without TTL indefinitely", () => {
      store.set("ns1", "key1", "value");
      const result = store.get("ns1", "key1");
      expect(result).toBe("value");
    });
  });

  describe("delete", () => {
    it("should delete a value", () => {
      store.set("ns1", "key1", "value");
      const deleted = store.delete("ns1", "key1");
      expect(deleted).toBe(true);
      expect(store.get("ns1", "key1")).toBeUndefined();
    });

    it("should return false for non-existent key", () => {
      const deleted = store.delete("ns1", "nonexistent");
      expect(deleted).toBe(false);
    });

    it("should clean up empty namespace", () => {
      store.set("ns1", "key1", "value");
      store.delete("ns1", "key1");
      const namespaces = store.namespaces();
      expect(namespaces).not.toContain("ns1");
    });
  });

  describe("list", () => {
    it("should list all keys in namespace", () => {
      store.set("ns1", "key1", "value1");
      store.set("ns1", "key2", "value2");
      store.set("ns1", "key3", "value3");
      
      const keys = store.list("ns1");
      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return empty array for non-existent namespace", () => {
      const keys = store.list("nonexistent");
      expect(keys).toHaveLength(0);
    });
  });

  describe("subscribe", () => {
    it("should call callback on set", () => {
      const callback = vi.fn();
      store.subscribe("ns1", undefined, callback);
      
      store.set("ns1", "key1", "value");
      
      expect(callback).toHaveBeenCalledWith("key1", "value", "set");
    });

    it("should call callback on delete", () => {
      const callback = vi.fn();
      store.subscribe("ns1", "key1", callback);
      
      store.set("ns1", "key1", "value");
      callback.mockClear();
      store.delete("ns1", "key1");
      
      expect(callback).toHaveBeenCalledWith("key1", undefined, "delete");
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = store.subscribe("ns1", undefined, callback);
      
      unsubscribe();
      store.set("ns1", "key1", "value");
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("broadcast", () => {
    it("should broadcast message to all subscribers", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      store.subscribe("ns1", undefined, callback1);
      store.subscribe("ns1", undefined, callback2);
      
      store.broadcast("ns1", { type: "update", data: "test" });
      
      expect(callback1).toHaveBeenCalledWith("*", { type: "update", data: "test" }, "set");
      expect(callback2).toHaveBeenCalledWith("*", { type: "update", data: "test" }, "set");
    });
  });

  describe("namespaces", () => {
    it("should return all namespaces", () => {
      store.set("ns1", "key1", "value1");
      store.set("ns2", "key1", "value1");
      store.set("ns3", "key1", "value1");
      
      const namespaces = store.namespaces();
      expect(namespaces).toHaveLength(3);
      expect(namespaces).toContain("ns1");
      expect(namespaces).toContain("ns2");
      expect(namespaces).toContain("ns3");
    });
  });

  describe("clear", () => {
    it("should clear all data", () => {
      store.set("ns1", "key1", "value1");
      store.set("ns2", "key1", "value1");
      
      store.clear();
      
      expect(store.list("ns1")).toHaveLength(0);
      expect(store.list("ns2")).toHaveLength(0);
      expect(store.namespaces()).toHaveLength(0);
    });
  });
});
