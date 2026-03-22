---
name: static-analysis
description: Run static analysis tools (slither, mythril) on Solidity contracts. Use to supplement manual code review.
version: 1.0.0
tier: 2
agent_types: [auditor]
---

# Static Analysis

Run automated tools to find vulnerabilities in smart contracts.

## When to use
- Before starting manual code review (run tools first to catch obvious issues)
- When auditing a large contract codebase

## Tools available
If slither is installed in the container:
```bash
slither /workspace/contract.sol --print human-summary
slither /workspace/contract.sol --detect reentrancy-eth,arbitrary-send
```

If not installed, perform manual pattern matching using grep:
```bash
# Find dangerous patterns
grep -n "\.call{value" contract.sol
grep -n "tx\.origin" contract.sol
grep -n "selfdestruct" contract.sol
grep -n "delegatecall" contract.sol
```

## Output
List all findings with line numbers, tool name, and severity. Feed into code-analysis skill for the full report.
