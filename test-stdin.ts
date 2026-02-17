import { getProcessSupervisor } from "./src/process/supervisor/index.js";

async function test() {
  const sup = getProcessSupervisor();
  const run = await sup.spawn({
    mode: "child",
    argv: ["/root/.opencode/bin/opencode", "run", "--yes", "-"],
    input: "echo hello from stdin test",
    stdinMode: "pipe-open",
  });
  const result = await run.wait();
  console.log("STDOUT:", result.stdout);
  console.log("EXIT:", result.exitCode);
}

test();
