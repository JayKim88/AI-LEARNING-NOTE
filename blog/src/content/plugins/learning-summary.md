---
title: "Learning Summary Plugin"
description: "Capture and document key learnings from Claude Code conversations with structured markdown output."
category: "Content & Learning"
tags: ["learning", "summary", "market", "spec", "mermaid", "python"]
lastUpdated: 2026-02-17
---



Capture and document key learnings from Claude Code conversations with structured markdown output.

## Process Flow

```mermaid
flowchart TD
    A([User Trigger]) -->|"summarize / document / what did I learn?"| B[Analyze Conversation]
    B --> C{Config Exists?}
    C -->|No| D[Prompt for Learning Repo Path]
    D --> E[Save Config]
    E --> F
    C -->|Yes| F[Extract Key Insights]
    F --> G[Ask: Which sections to include?]
    G --> H{Sections Selected}
    H --> I1[Key Insights]
    H --> I2[Problem & Solution]
    H --> I3[Code Examples]
    H --> I4[Resources & References]
    H --> I5[Next Steps]
    I1 & I2 & I3 & I4 & I5 --> J[Generate Markdown Document]
    J --> K[Save to learning_repo/learnings/YYYY-MM-DD-topic.md]
    K --> L{auto_commit?}
    L -->|Yes| M[Git Commit]
    M --> N{auto_push?}
    N -->|Yes| O[Git Push]
    N -->|No| P([Done])
    O --> P
    L -->|No| P
```

## Features

- **Automatic Analysis**: Extracts insights, patterns, and key takeaways from conversations
- **Structured Output**: Generates well-organized markdown documents with customizable sections
- **Git Integration**: Optional auto-commit and auto-push to your learning repository
- **Bilingual Support**: Works with both English and Korean conversations
- **Customizable Sections**: Choose which sections to include (insights, examples, resources, etc.)
- **Session History**: Analyze single or multiple conversation sessions (planned)

## Installation

### From Marketplace (Recommended)

```bash
/plugin marketplace add JayKim88/claude-ai-engineering
/plugin install learning-summary
```

### Via npx

```bash
# Install learning-summary plugin only
npx github:JayKim88/claude-ai-engineering learning-summary

# Or install all plugins
npx github:JayKim88/claude-ai-engineering
```

### Local Development

```bash
cd ~/Documents/Projects/claude-ai-engineering
npm run link
```

## Requirements

- Claude Code CLI
- Git (for auto-commit feature)
- Bash shell (macOS/Linux)

## Configuration

Edit `~/.claude/skills/learning-summary/config.yaml`:

```yaml
# Where to save learning notes
learning_repo: "/Users/you/Documents/Projects/learning-notes"
output_dir: "learnings"

# Git integration
auto_commit: true   # Auto-commit after saving
auto_push: false    # Auto-push to remote

# Categorization
categories:
  - claude-code
  - ai-engineering
  - development

tags:
  - learning
  - insights
```

## Usage

### Trigger Phrases

Use any of these phrases during or after a conversation:

- "document this conversation"
- "summarize key learnings"
- "save this as learning notes"
- "what did I learn today?"
- "capture insights from this session"

### Example

```
User: "We just debugged a complex authentication issue. Document this learning."

Claude: I'll help you document the key learnings from our conversation.

[Analyzes conversation and asks:]

Which sections would you like to include?
☑ Key Insights
☑ Problem & Solution
☑ Code Examples
☐ Resources & References
☐ Next Steps

[After selection, generates and saves markdown document]

✅ Saved to: ~/learning-notes/learnings/2026-01-17-authentication-debugging.md
✅ Git committed: "Add learning: Authentication debugging techniques"
```

## Output Format

Generated documents follow this structure:

```markdown
# [Topic]

**Date**: 2026-01-17
**Category**: claude-code, debugging
**Tags**: authentication, security

## Key Insights
- [Insight 1]
- [Insight 2]

## Problem & Solution
### Problem
...

### Solution
...

## Code Examples
```[language]
...
```

## Resources & References
- [Link 1]
- [Link 2]

## Next Steps
- [ ] Action item 1
- [ ] Action item 2
```

## Advanced Usage

### Section Customization

The skill will ask which sections to include for complex conversations:
- **Key Insights** - Main takeaways
- **Problem & Solution** - Issue analysis and resolution
- **Code Examples** - Relevant code snippets
- **Resources & References** - Links and documentation
- **Next Steps** - Action items

### Multi-Session Analysis (Planned)

Analyze learnings across multiple conversation sessions:
- Last 24 hours
- Last week
- Specific project sessions

## Tips

1. **Regular Documentation**: Use after significant conversations to build your knowledge base
2. **Tagging**: Consistent tags help find related learnings later
3. **Git Integration**: Enable auto-commit to never lose insights
4. **Review Regularly**: Set up weekly reviews of your learning notes

## File Naming

Generated files use this format:
```
YYYY-MM-DD-topic-slug.md
```

Examples:
- `2026-01-17-debugging-authentication.md`
- `2026-01-18-claude-code-plugins.md`

## Integration with Other Tools

- **Obsidian**: Point `learning_repo` to your Obsidian vault
- **Notion**: Export markdown files to Notion
- **GitHub**: Use as a public learning-in-public repository

## Troubleshooting

**Issue**: "Learning repository not found"
- **Solution**: Create the directory or update `config.yaml` with correct path

**Issue**: "Git commit failed"
- **Solution**: Ensure git is initialized in your learning repository

**Issue**: "Permission denied on scripts"
- **Solution**: Run `chmod +x ~/.claude/skills/learning-summary/scripts/*.sh`

## Related Plugins

- **session-wrap**: Comprehensive session analysis with documentation updates
- **project-insight**: Project-level analysis and insights

## Contributing

Found a bug or have a feature request? Open an issue at:
https://github.com/JayKim88/claude-ai-engineering/issues

## License

MIT License - See LICENSE file for details

## Author

**Jay Kim**
- GitHub: [@JayKim88](https://github.com/JayKim88)
