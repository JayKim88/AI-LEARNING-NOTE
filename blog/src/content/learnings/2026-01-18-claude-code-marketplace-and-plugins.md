---
title: "Understanding Claude Code Marketplace and Plugins"
date: 2026-01-18
description: "Claude Code's marketplace is a **decentralized system**, not a centralized App Store."
category: learnings
draft: false
---

## Key Concepts

### 1. The Nature of the Marketplace

**Marketplace = GitHub Repository**

Claude Code's marketplace is a **decentralized system**, not a centralized App Store.

| Feature | Description |
|---------|-------------|
| **Type** | Decentralized (similar to npm, pip) |
| **How to create** | GitHub repository + `.claude-plugin/marketplace.json` file |
| **Approval process** | No Anthropic approval needed |
| **Identifier** | `owner/repo-name` format (e.g., `team-attention/plugins-for-claude-natives`) |

### 2. Marketplace vs Plugin

**Analogy: App Store vs App**

| Concept | Real Example | Description |
|---------|-------------|-------------|
| **Marketplace** | `team-attention/plugins-for-claude-natives` | A catalog of multiple plugins (App Store) |
| **Plugin** | `agent-council`, `clarify`, `dev` | An extension providing individual functionality (App) |

**Relationship:**
```
Marketplace (GitHub Repo)
├── Plugin A
├── Plugin B
└── Plugin C
```

### 3. Marketplace Structure

```
repository/
├── .claude-plugin/
│   ├── marketplace.json    # Marketplace definition (plugin list)
│   └── plugin.json         # Metadata
└── plugins/
    ├── plugin-1/           # Individual plugin
    ├── plugin-2/
    └── plugin-3/
```

## New Learnings

### Before: What I Misunderstood

- Marketplace = a centralized store operated by Anthropic
- `/plugin marketplace add` = publishing my own plugin
- Plugins must be registered in a marketplace to be used
- Anthropic approval is required

### After: How It Actually Works

- The marketplace is a decentralized system — anyone can create one
- `/plugin marketplace add` = connecting someone else's marketplace to my local Claude Code
- There are 3 ways to install plugins (marketplace, npx, symbolic link)
- No approval needed — just push to GitHub

## Practical Examples

### Example 1: Installing via Marketplace

```bash
# Step 1: Connect a marketplace to your Claude Code
/plugin marketplace add team-attention/plugins-for-claude-natives

# Step 2: Install the desired plugin
/plugin install agent-council
```

**What this means:**
- "Subscribing to someone else's marketplace in your local Claude Code"
- Enables installation of plugins listed in that marketplace
- This does NOT create a marketplace for you
- This does NOT publish anything for others to see

### Example 2: Direct Installation via npx (no marketplace needed)

```bash
# Install the agent-council plugin directly
npx github:team-attention/agent-council
```

**Advantages:**
- Installs immediately without marketplace registration
- Copies to the current project's `.claude/skills/agent-council/`
- Automatically detects Claude Code/Codex CLI

### Example 3: Symbolic Link for Local Development

```bash
# Link to the global skills directory
ln -s /path/to/cloned-repo/plugins/agent-council/skills/agent-council \
      ~/.claude/skills/agent-council
```

**Advantages:**
- Edit in real time
- Share across multiple projects

### Example 4: marketplace.json Structure

```json
{
  "name": "team-attention-plugins",
  "owner": {
    "name": "Team Attention",
    "url": "https://github.com/team-attention"
  },
  "description": "Claude Code plugins for power users",
  "plugins": [
    {
      "name": "agent-council",
      "description": "Collect opinions from multiple AI agents",
      "source": "./plugins/agent-council"
    },
    {
      "name": "clarify",
      "description": "Transform vague requirements into specs",
      "source": "./plugins/clarify"
    }
  ]
}
```

### Example 5: Minimal Plugin Structure

```
my-skill/
├── SKILL.md          # Skill definition read by Claude
└── scripts/
    └── main.sh       # Execution script
```

**SKILL.md example:**
```markdown
---
name: my-skill
description: Short description that triggers when user says "keyword"
---

# My Skill

Detailed description for Claude to understand how to use this skill.

## Usage

```bash
./scripts/main.sh "user query"
```
```

## Common Misconceptions

| Misconception | Reality |
|---------------|---------|
| Marketplace = centralized App Store | Decentralized — anyone can create one |
| `/plugin marketplace add` = publishing my plugin | Connects someone else's marketplace to your local instance |
| Anthropic approval required | No approval needed — just push to GitHub |
| Plugin = Marketplace | Plugin (app) is a subset of Marketplace (store) |
| Must register in a marketplace to use | Can also install via npx or symbolic link |

## References

### File Locations
- **Marketplace definition**: `.claude-plugin/marketplace.json`
- **Global skills**: `~/.claude/skills/`
- **Local skills**: `project/.claude/skills/`

### Real Examples
- **agent-council plugin**: `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/plugins/agent-council/`
- **Marketplace definition file**: `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/.claude-plugin/marketplace.json`

### GitHub Repository
- https://github.com/team-attention/plugins-for-claude-natives

### Source Document
- `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/claude-code-marketplace-guide.md`

## Next Steps

1. Use the `learning-summary` skill regularly to record learnings
2. Explore other plugins (`agent-council`, `clarify`, `dev`)
3. Try building a custom skill/plugin from scratch
4. Consider creating your own marketplace repository
5. Establish a strategy for global vs local installation
