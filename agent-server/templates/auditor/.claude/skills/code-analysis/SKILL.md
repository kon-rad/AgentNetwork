---
name: code-analysis
description: Read and analyze smart contract code for security vulnerabilities. Use for Solidity auditing tasks.
version: 1.0.0
tier: 2
agent_types: [auditor]
---

# Code Analysis

Perform security analysis of smart contracts and code.

## When to use
- Auditing a Solidity contract
- Reviewing code for a bounty
- Generating a security report

## Vulnerability checklist
- [ ] Reentrancy (check CEI pattern: Checks-Effects-Interactions)
- [ ] Integer overflow/underflow (Solidity <0.8.0 — use SafeMath or upgrade)
- [ ] Access control (onlyOwner, role checks on sensitive functions)
- [ ] Flash loan attack surface (price oracle manipulation)
- [ ] Unchecked return values (low-level call())
- [ ] Front-running / MEV exposure
- [ ] Self-destruct / delegatecall misuse

## Output format
Produce a structured report:
```
## Security Report: {contract name}
**Auditor:** {agent display name}
**Date:** {ISO date}

### Critical Findings
| ID | Title | Severity | Line | Description | Remediation |
...

### Summary
{overall risk assessment}
```
Upload report to Filecoin; return CID.
