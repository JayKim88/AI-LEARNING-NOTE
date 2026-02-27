---
title: "Spec Interview Plugin — AI-Driven Requirements Gathering with AskUserQuestion"
date: 2026-02-03
description: "A new Claude Code plugin that collects requirements by having **the AI interview the user**."
category: learnings
draft: false
---

## Key Concepts

### 1. Spec Interview Plugin
A new Claude Code plugin that collects requirements by having **the AI interview the user**.

**Difference from the traditional approach:**
- **Traditional**: User writes requirements → AI executes
- **Spec Interview**: AI asks questions → User answers → AI derives requirements

### 2. Hidden Use of the AskUserQuestion Tool
A pattern that actively leverages Claude Code's built-in `AskUserQuestion` tool **outside of Plan mode**.

**Tool capability:**
```python
AskUserQuestion(
    questions=[
        {
            "question": "Actual question content",
            "header": "Short label (up to 12 chars)",
            "options": [
                {"label": "Option A", "description": "Description"},
                {"label": "Option B", "description": "Description"}
            ],
            "multiSelect": false  # true allows multiple selections
        }
    ]
)
```

### 3. Simple Skill Pattern
Implemented as a **single skill pattern** rather than multi-agent:
- Sequential conversation flow (interviews cannot be parallelized)
- AskUserQuestion handles all interaction
- No agent coordination needed

### 4. The Importance of Question Quality

**Bad questions (to avoid):**
- "Is security important?" → Always yes
- "Should performance be good?" → Too vague
- "Should we follow best practices?" → Meaningless

**Good questions (to aim for):**
- "If two users edit the same item simultaneously, should we use last-write-wins or detect the conflict?"
- "If an external API goes down, should we queue the request or show an error immediately?"
- "Do you prioritize a more flexible architecture (longer to implement) vs. a simpler implementation (faster but harder to scale)?"

### 5. Presenting Real Trade-offs

**Bad options:**
- Option A: Fast, safe, and scalable (obviously good)
- Option B: Slow, unsafe, and non-scalable (obviously bad)

**Good options:**
- Option A: Server-side rendering (better SEO, slower interactivity)
- Option B: Client-side rendering (fast interactivity, harder SEO)
- Option C: Hybrid (best of both, increased complexity)

## New Learnings

### Before: AskUserQuestion used only in Plan mode
- Enter Plan mode → ask questions → approve → execute
- User input received only during the planning phase

### After: Can be actively used in regular Skills too
- Regular skills call AskUserQuestion directly
- Questions can be asked iteratively over multiple rounds
- Conversational requirements gathering is possible

### Before: User had to clearly describe requirements
```
User: "Build me a login page. Email/password auth, social login support..."
→ User had to think of everything themselves
```

### After: AI asks questions to surface requirements
```
User: "I want to build a login page"
AI: "What auth methods? Session duration? Password recovery? Multi-device login?"
→ AI finds the gaps the user missed
```

## Practical Application

### 1. Create Plugin Structure

```bash
# Copy template
cp -r templates/plugin-template plugins/spec-interview

# Rename skill directory
mv plugins/spec-interview/skills/PLUGIN_NAME \
   plugins/spec-interview/skills/spec-interview

# Remove unnecessary directories (Simple Skill, so not needed)
rm -rf plugins/spec-interview/agents
rm -rf plugins/spec-interview/commands
```

### 2. Write plugin.json

```json
{
  "name": "spec-interview",
  "version": "1.0.0",
  "description": "AI-driven requirements gathering through in-depth interviews",
  "keywords": ["requirements", "interview", "specification", "planning"]
}
```

### 3. Core Algorithm in SKILL.md

```markdown
### Step 1: Parse Initial Request
- Extract topic
- Understand context
- Identify focus areas

### Step 2: Generate First Question Set
- 2-4 questions via AskUserQuestion
- Rotate through 6 categories (Technical, UX, Business, Security, Trade-offs, NFR)
- Select only non-obvious questions

### Step 3: Analyze Responses
- Track coverage (✅ done, ⚠️ needs more, ❌ not started)
- Identify gaps
- Flag ambiguous answers

### Step 4: Generate Next Question Set
- Follow-up questions based on gaps
- Dig deeper into ambiguous answers
- Validate trade-offs

### Step 5: Determine Completion
- 3-5 rounds (simple features)
- 5-8 rounds (complex projects)
- Stop when diminishing returns

### Step 6-9: Generate & Save Spec
- Use 12-section template
- Omit empty sections
- Preserve user's language
- Save file and confirm
```

### 4. Update marketplace.json

```json
{
  "plugins": [
    // ... existing plugins
    {
      "name": "spec-interview",
      "description": "AI-driven requirements gathering through in-depth interviews",
      "source": "./plugins/spec-interview"
    }
  ]
}
```

### 5. Local Link and Test

```bash
# Create symbolic link
npm run link

# Verify
ls -la ~/.claude/skills/spec-interview/

# Test in Claude Code
"Interview me" or "interview me about [topic]"
```

## Code Examples

### AskUserQuestion Usage Example

```python
# Format used in actual SKILL.md
AskUserQuestion(
    questions=[
        {
            "question": "What authentication method should users use to log in?",
            "header": "Auth Method",
            "options": [
                {
                    "label": "Email/password only",
                    "description": "Simple to implement with full control over user data, but requires users to create yet another account"
                },
                {
                    "label": "Social login only",
                    "description": "Low signup friction and fast, but high dependency on external services and requires integration setup"
                },
                {
                    "label": "Support both",
                    "description": "Gives users a choice, but increases implementation complexity and maintenance cost"
                }
            ],
            "multiSelect": false
        }
    ]
)
```

### Generated Spec Template Structure

```markdown
# [Feature] - Technical Specification

## 1. Overview
- Purpose
- Scope (In/Out)

## 2. Requirements
- Functional Requirements (FR-1, FR-2, ...)
- Non-Functional Requirements (NFR-1, NFR-2, ...)

## 3. Technical Design
- Architecture Overview
- Technology Stack
- Key Components
- Data Models

## 4. User Experience
- User Flows
- UI/UX Considerations

## 5. Implementation Details
- Phase 1, Phase 2, ...
- Technical Decisions (with rationale)

## 6. Edge Cases & Error Handling

## 7. Security & Privacy

## 8. Testing Strategy

## 9. Risks & Mitigations

## 10. Open Questions

## 11. Success Metrics

## 12. References
- Interview Notes
```

### Final Plugin Directory Structure

```
plugins/spec-interview/
├── .claude-plugin/
│   └── plugin.json          # Metadata
├── skills/
│   └── spec-interview/
│       └── SKILL.md         # 650-line execution algorithm
├── README.md                # 257-line user documentation
└── CLAUDE.md                # 497-line developer guide
```

## Common Misconceptions

### Misconception 1: "AskUserQuestion is only for Plan mode"
**Reality**: It can be used in regular skills too. Just specify the trigger phrase in the `description` field of SKILL.md and the skill runs automatically.

### Misconception 2: "Complex features require Multi-agent"
**Reality**: A Simple Skill is sufficient for Spec Interview. Sequential conversation flow does not need parallel processing.

### Misconception 3: "More questions is better"
**Reality**: **Quality** of questions is what matters. 2-4 deep questions beat 10 obvious ones.

### Misconception 4: "Every section must be filled in"
**Reality**: Empty sections should be omitted. Focus only on what the user actually answered.

### Misconception 5: "The skill must be called directly"
**Reality**: Use the trigger phrase in the `description` field of SKILL.md and the skill runs automatically.

## References

### Project Files
- `/Users/jaykim/Documents/Projects/claude-ai-engineering/plugins/spec-interview/`
- `SKILL.md` - Execution algorithm (17,487 bytes)
- `README.md` - User documentation (8,711 bytes)
- `CLAUDE.md` - Developer guide (12,605 bytes)

### Related Documents
- `templates/NEW_PLUGIN_GUIDE.md` - Plugin creation guide
- `plugins/learning-summary/` - Simple Skill reference example
- `plugins/project-insight/` - Multi-agent reference example

### Inspiration
- **Danny Postma's insight**: "Having AI ask questions" is more effective than "having users explain"
- **Tariq (Claude Code developer)**: Mentioned that AskUserQuestion can be used outside of Plan mode

### Git Commit
```bash
Commit: 587b7f5
Message: feat: add spec-interview plugin
Files: 5 files changed, 1426 insertions(+)
```

## Next Steps

### Immediate Actions
1. **Test**: Run `"Interview me about a login page"`
2. **Try another topic**: `"Interview me about building a REST API"`
3. **Check generated spec**: A `./*-spec.md` file will be created in the current directory

### Future Improvements
1. **Visual diagrams**: Generate architecture diagrams with Mermaid.js
2. **Collaborative interviews**: Interview multiple stakeholders simultaneously with answer attribution tagging
3. **Spec templates**: Templates per common pattern (CRUD, real-time, auth, etc.)
4. **Resume interview**: Read partial spec and continue from where it left off
5. **Task integration**: Auto-create Linear/Jira tickets

### Learning Extensions
1. **Improve other Skills**: Add AskUserQuestion to existing plugins
2. **Question design research**: Study more patterns of good questions
3. **User feedback**: Improve question quality based on real usage

---

**Date**: 2026-02-03
**Tags**: #claude-code #askuserquestion #plugin-development #requirements-gathering #spec-interview
**Category**: claude-code

**Key Insight**:
> "Great tools don't come from building something new — they come from combining what already exists in a different way."
>
> AskUserQuestion was already there, but almost nobody was using it actively outside of Plan mode. Simply reframing it as an interview-style interaction is enough to create entirely new value.
