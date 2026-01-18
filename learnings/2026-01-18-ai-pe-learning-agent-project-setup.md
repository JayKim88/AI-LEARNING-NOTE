# AI PE Learning Agent Project Setup

> Complete project initialization for AI Product Engineer learning journey with meta-learning approach

**Date:** 2026-01-18
**Category:** AI Engineering, Project Management
**Tags:** #meta-learning #multi-agent #langgraph #project-setup #portfolio

---

## Key Concepts

### Meta-Learning Approach
Building AI agents to learn AI engineering - the tool creation process itself becomes the learning journey. Instead of following tutorials, you solve a real problem (managing your own learning) while acquiring AI engineering skills.

### Multi-Agent System Architecture
Four specialized agents working together:
- **Curriculum Architect**: Curates weekly learning goals and resources
- **Assignment Generator**: Creates practical coding assignments
- **Code Critic**: Reviews code for AI Engineering Best Practices
- **Progress Tracker**: Manages learning history in Vector DB

### Separate Repository Strategy
`ai-pe-learning-agent` as standalone project, not a plugin in `claude-ai-engineering`:
- Different scope and purpose
- Independent evolution and versioning
- Clear portfolio value
- Dedicated learning artifacts in `learning/` directory

### Learning Artifacts Structure
```
learning/
├── week-00-python-basics/
│   ├── notes.md              # Learning notes
│   ├── exercises/            # Practice code
│   ├── assignments/          # Agent-generated tasks
│   └── reviews/              # Code review results
```

This structure proves:
- Transparent learning process
- Dogfooding (using your own tools)
- Growth over time (failure → improvement)
- Real usage examples

---

## New Learnings

### Before Understanding
- Initially considered including AI PE project in `plugins/` directory
- Thought documents should be in Korean for personal use
- Unclear about repository structure and organization
- Uncertain about what to include in learning artifacts

### After Understanding
**Repository Organization:**
- Separate repositories have clear boundaries and purposes
- `claude-ai-engineering`: Plugin marketplace and AI engineering toolkit
- `ai-pe-learning-agent`: Dedicated learning management system

**Documentation Strategy:**
- English for broader reach and portfolio value
- Personal information (PROFILE.md) excluded from git commits
- Origin documents preserved (PROJECT-ORIGIN.md from idea.md)
- Comprehensive roadmap with 5 phases + Week 0 Python basics

**Learning Process:**
- Week 0 added for TypeScript → Python transition (1 week)
- Each week includes notes, exercises, assignments, and reviews
- Learning artifacts are core portfolio differentiator
- Failed attempts documented alongside successes

**Tech Stack Decision:**
- Python-first approach (AI ecosystem standard)
- TypeScript optional for later productization
- LangGraph for agentic workflows (not entire LangChain)
- Focus on depth over breadth

---

## Practical Examples

### Project Structure Created
```
ai-pe-learning-agent/
├── README.md                    # English
├── docs/
│   ├── ROADMAP.md              # Comprehensive 5-phase plan
│   ├── GETTING-STARTED.md      # Setup guide
│   ├── PROJECT-ORIGIN.md       # Genesis of idea
│   └── PROFILE.md              # Personal info (gitignored)
├── src/
│   ├── __init__.py
│   ├── hello_claude.py         # First example with TS comparisons
│   └── agents/
│       └── __init__.py
├── learning/
│   └── week-00-python-basics/
│       └── notes.md            # TypeScript → Python guide
├── requirements.txt
├── .env.example
└── .gitignore
```

### Git Ignore Pattern for Personal Data
```gitignore
# Personal information (excluded from commits)
docs/PROFILE.md
```

This allows agents to use your background for personalization while keeping it private.

### TypeScript to Python Comparison Pattern
```python
# TypeScript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);

# Python
numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]  # List comprehension!
```

Week 0 notes.md provides extensive comparisons for TypeScript developers.

### Repository Naming
```
Repository: ai-pe-learning-agent
Description: Multi-agent system for AI Product Engineer learning journey.
             Meta-learning project: building AI agents to become an AI
             engineer. LangGraph, Claude API, Vector DB, Python.
```

Clear, searchable, and conveys purpose immediately.

---

## Common Misconceptions

### "Learning artifacts should be private"
**Reality:** Public learning process is a portfolio strength. Shows:
- Transparent growth journey
- Willingness to share mistakes and improvements
- Real-world problem-solving
- Consistent learning habit

Exception: Personal career details (PROFILE.md) excluded via .gitignore

### "Documentation should be in native language for personal projects"
**Reality:** English documentation:
- Increases portfolio reach
- Demonstrates communication skills
- Makes project accessible to global audience
- Better for job applications and networking

### "Need to learn entire LangChain ecosystem"
**Reality:** Focus on LangGraph specifically:
- State-based workflows
- Circular structures (retry logic)
- Visualization and debugging
- Avoid scope creep by learning selectively

### "Should include everything in one repository"
**Reality:** Separate repositories when:
- Different scope and purpose
- Independent evolution needed
- Clear boundary between projects
- Better organization and clarity

---

## References

### Files Created/Modified

**New ai-pe-learning-agent project:**
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/README.md`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/docs/ROADMAP.md` (38,237 bytes)
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/docs/GETTING-STARTED.md`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/docs/PROJECT-ORIGIN.md`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/docs/PROFILE.md` (gitignored)
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/learning/week-00-python-basics/notes.md`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/src/hello_claude.py`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/.gitignore`
- `/Users/jaykim/Documents/Projects/ai-pe-learning-agent/requirements.txt`

**Removed from claude-ai-engineering:**
- `docs/` folder (AI-PE-ROADMAP.md, AI-PE-ROADMAP2.md, ROADMAP-COMPARISON.md)

**Source documents:**
- `idea.md` → PROJECT-ORIGIN.md (translated)
- `career.md` → PROFILE.md (translated, gitignored)
- `test.md` → insights integrated into ROADMAP.md

### Key Documentation

**ROADMAP.md sections:**
- Phase 0: Project Preparation (1 week)
- Phase 1: MVP - Prompt Reviewer (2 weeks) - Few-shot, CoT, ReAct
- Phase 2: Code Reviewer (2 weeks) - Validation, Security
- Phase 3: Vector DB Integration (2 weeks) - RAG, Hybrid Search
- Phase 4: LangGraph + Evaluation (2 weeks) - LLM-as-a-Judge
- Phase 5: Full Integration + Optimization (2 weeks) - Semantic Caching

**Week 0 Content:**
- Day 1-2: Python Fundamentals (TypeScript comparisons)
- Day 3-4: AI Ecosystem (pip, venv, Claude API)
- Day 5: Pydantic (Data Validation)
- Day 6-7: Mini Chatbot Project

### Technologies Mentioned
- **Languages:** Python 3.11+, TypeScript (future)
- **AI:** Claude API (Anthropic SDK), GPT-4o (for LLM-as-a-Judge)
- **Frameworks:** LangGraph, LangChain (selective)
- **Storage:** Vector DB (Supabase/Chroma), JSON files
- **Tools:** Pydantic, Poetry/uv, pytest, ruff, mypy
- **Optional:** Streamlit, Next.js, Docker

---

## Decision Points

### 1. Repository Structure
**Decision:** Separate repository (`ai-pe-learning-agent`)
**Rationale:**
- Different scope from claude-ai-engineering toolkit
- Clear portfolio boundary
- Independent versioning and evolution
- Dedicated learning artifacts directory

### 2. Language Strategy
**Decision:** Python-first, TypeScript optional later
**Rationale:**
- AI ecosystem centers on Python
- LangChain/LangGraph Python-native
- Can add TypeScript for productization in Phase 5
- Week 0 bridges TypeScript → Python transition

### 3. Roadmap Choice
**Decision:** Python "정석" (standard) approach over TypeScript version
**Rationale:**
- Industry standard (50/50 score vs 30/50)
- Deeper AI engineering fundamentals
- Better for long-term career growth
- TypeScript skills still valuable for future integration

### 4. Documentation Language
**Decision:** All English
**Rationale:**
- Portfolio and job application value
- Global reach
- Professional communication demonstration
- Personal info (PROFILE.md) excluded via gitignore

### 5. Learning Artifacts Visibility
**Decision:** Public by default, personal info excluded
**Rationale:**
- Transparent learning process shows growth
- Dogfooding evidence (using own tools)
- Interview preparation material
- Blog post source material

---

## Portfolio Value

### Quantitative Metrics Planned
From ROADMAP.md:
- **Learning Records:** 12 weeks, 50+ assignments, 100+ code reviews
- **Performance Improvements:**
  - Prompt quality: 40% → 85% (LLM-as-a-Judge measured)
  - Response consistency: 60% → 99% (Guardrails)
  - Hallucination: 25% → 0% (Validation logic)
- **Cost Reduction:** API cost 70% via Semantic Caching
- **Code:** Python 5,000+ lines, 80%+ test coverage
- **Blog Posts:** 12+ technical posts over 6 months

### Interview Preparation
- "Why did you build this?" → PROJECT-ORIGIN.md
- "Biggest technical challenge?" → learning/week-N/notes.md reflections
- "Failure and recovery?" → reviews/ directory (failed → passed examples)
- "What did you learn?" → 12 weeks of documented learning

### Blog Post Topics (12+ planned)
1. Project planning and meta-learning approach
2. System Prompt design process
3. Guardrails for 100% response control
4. Code review agent with Best Practices
5. Reducing hallucination to 0%
6. Vector DB for learning history
7. LLM-as-a-Judge evaluation
8. LangGraph workflows
9. Semantic Caching 70% cost reduction
10. Multi-agent collaboration
11. 12-week learning data insights
12. 3-month retrospective

---

## Next Steps

### Immediate Actions
- [ ] Create GitHub repository `ai-pe-learning-agent`
- [ ] Push initial commit to GitHub
- [ ] Setup Python virtual environment
- [ ] Test Claude API with hello_claude.py
- [ ] Complete Week 0 Python basics (7 days)

### Week 0 Goals (2026-01-18 ~ 2026-01-25)
- [ ] Understand basic Python syntax
- [ ] Virtual environment and package management
- [ ] Successfully call Claude API
- [ ] Data validation with Pydantic
- [ ] Ready to start Phase 1

### Phase 1 Preparation
- [ ] Review ROADMAP.md Phase 1 details
- [ ] Study Few-shot, Chain-of-Thought, ReAct patterns
- [ ] Understand Structured Output with Pydantic
- [ ] Research Guardrails implementation
- [ ] Write Phase 1 detailed design document

### Documentation Tasks
- [ ] Create ARCHITECTURE.md (system design details)
- [ ] Create DEVELOPMENT.md (development log)
- [ ] Consider blog platform (Medium, personal blog, velog)
- [ ] Decide repository publicity strategy (public from start recommended)

### Learning Resources to Review
- [Python for JavaScript Developers](https://www.valentinog.com/blog/python-for-js/)
- [Real Python - Python Basics](https://realpython.com/python-basics/)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Pydantic Docs](https://docs.pydantic.dev/)
- [LangGraph Documentation](https://python.langchain.com/docs/langgraph)

---

## Session Summary

**What Was Accomplished:**
1. ✅ Created complete ai-pe-learning-agent project structure
2. ✅ Translated all documentation to English (README, ROADMAP, GETTING-STARTED, PROJECT-ORIGIN)
3. ✅ Created PROFILE.md for agent personalization (gitignored)
4. ✅ Setup Week 0 Python basics guide with TypeScript comparisons
5. ✅ Configured .gitignore to exclude personal information
6. ✅ Removed docs/ folder from claude-ai-engineering
7. ✅ Made initial git commit (11 files, 1,952 insertions)

**Files Created:** 11 files across project structure
**Total Lines:** 1,952 lines of documentation and code
**Time Investment:** Initial setup complete, ready for Week 0

**Key Insight:**
The meta-learning approach—building AI agents to learn AI engineering—creates a self-reinforcing learning cycle. The project serves simultaneously as:
- Learning tool (manages your own learning)
- Learning process (builds AI engineering skills)
- Learning artifact (portfolio evidence)

This triple-value proposition makes it a uniquely powerful portfolio project.

---

**Created:** 2026-01-18
**Session Duration:** Full project setup and planning
**Next Session:** GitHub repository creation and Week 0 Python basics
