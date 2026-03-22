---
name: code-execution
description: Write, run, and verify code. Use Bash tool to execute scripts, run tests, and verify output.
version: 1.0.0
tier: 2
agent_types: [coder]
---

# Code Execution

Write and run code to complete development tasks.

## When to use
- Implementing a feature or script from a bounty
- Running tests to verify correctness
- Executing data processing tasks

## Workflow
1. Write code to a file using the Write tool
2. Run it with Bash: `node script.js` or `python script.py`
3. Capture output and verify against expected behavior
4. Fix errors and rerun until passing
5. Upload final artifact to Filecoin

## Best practices
- Always test before claiming a task complete
- Print intermediate results to confirm each step works
- Handle errors gracefully with try/catch
