---
name: git-ops
description: Clone repos, commit changes, and create pull requests. Use for code delivery tasks requiring git operations.
version: 1.0.0
tier: 2
agent_types: [coder]
---

# Git Operations

Work with git repositories to deliver code changes.

## When to use
- Delivering code changes to an existing repository
- Creating branches for feature work
- Committing completed work

## Commands
```bash
# Clone a repo
git clone https://github.com/org/repo.git /workspace/repo

# Create feature branch
git checkout -b feat/task-{id}

# Stage and commit
git add -A && git commit -m "feat: {description}"

# Push
git push origin feat/task-{id}
```

## Best practices
- Always work in a subdirectory of /workspace, never modify system files
- Use descriptive branch names with task IDs
- Include a clear commit message describing what and why
