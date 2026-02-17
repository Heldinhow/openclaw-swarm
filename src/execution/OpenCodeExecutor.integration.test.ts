import { describe, it, expect, beforeEach } from "vitest";
import { OpenCodeExecutor } from "./OpenCodeExecutor.js";
import * as fs from "fs";

describe("OpenCodeExecutor Integration Tests", () => {
  let executor: OpenCodeExecutor;

  beforeEach(() => {
    executor = new OpenCodeExecutor({
      defaultTimeout: 60000,
      workingDirectory: "/tmp",
      model: "minimax/MiniMax-M2.5",
    });
  });

  it("should execute task and create file", async () => {
    const testFile = "/tmp/opencode-test-" + Date.now() + ".txt";
    
    const result = await executor.run({
      id: "test-create-file",
      instructions: `Create a file called ${testFile} with content 'integration test works'`,
    });

    console.log("Result:", JSON.stringify(result, null, 2));
    
    // Check execution succeeded
    expect(result.success).toBe(true);
    expect(result.taskId).toBe("test-create-file");
    
    // Verify file was created
    const content = fs.readFileSync(testFile, "utf-8");
    expect(content).toContain("integration test works");
    
    // Cleanup
    fs.unlinkSync(testFile);
  }, 90000);

  it("should use specified model", async () => {
    const executorWithModel = new OpenCodeExecutor({
      defaultTimeout: 60000,
      workingDirectory: "/tmp",
      model: "minimax/MiniMax-M2.5",
    });

    const result = await executorWithModel.run({
      id: "test-model",
      instructions: "Reply with exactly: MODEL_TEST_OK",
    });

    console.log("Model result:", result.output.stdout);
    expect(result.success).toBe(true);
    expect(result.metrics.model).toBe("minimax/MiniMax-M2.5");
  }, 90000);
});
