---
title: "Spec Validator"
description: "Spec Validator helps you track spec-driven development by comparing your specification documents against implementation checklists. Get detailed validation..."
category: "Interview & Planning"
tags: ["spec", "validator", "interview", "learning", "mermaid", "ai"]
lastUpdated: 2026-02-17
---



> Validate implementation progress against specification documents with 100-point scored reports.

Spec Validator helps you track spec-driven development by comparing your specification documents against implementation checklists. Get detailed validation reports with 4-dimension scoring, issue categorization, and actionable recommendations.

---

## Process Flow

```mermaid
flowchart TD
    A([User Trigger]) -->|"validate spec implementation"| B{Checklist Exists?}
    B -->|No| C["Generate Checklist Template<br/>from spec document"]
    C --> D[User Fills .spec-checklist.yaml]
    D --> E
    B -->|Yes| E{Validation Mode}

    E -->|Full ~30s| F[4-Dimension Validation]
    E -->|Quick ~10s| G[Completeness + Adherence Only]
    E -->|Requirements ~15s| H[FR/NFR Progress Only]

    subgraph Dimensions["4-Dimension Scoring (100 pts)"]
        D1["Implementation Completeness (40pts)<br/>FR, NFR, models, APIs"]
        D2["Implementation Quality (25pts)<br/>Test coverage, edge cases, docs"]
        D3["Spec Adherence (20pts)<br/>Checklist matches spec exactly"]
        D4["Progress Transparency (15pts)<br/>Status tracking, blockers"]
    end

    F --> Dimensions
    Dimensions --> I[Calculate Total Score]
    G & H --> I

    I --> J{Score Grade}
    J -->|95+| K[A+ Ship it!]
    J -->|90-94| L[A Grade - Ready]
    J -->|75-89| M[B Grade - Improve]
    J -->|< 75| N[C/D/F - Fix Issues]

    K & L & M & N --> O[Generate Validation Report]
    O --> P(["Report: Score + Issues by Severity<br/>+ Prioritized Recommendations"])

    N -->|Fix & re-validate| A
```

## Quick Start

### 1. Create a Specification

Use the `spec-interview` plugin to create a comprehensive spec.

### 2. Validate and Generate Checklist

```
"Validate my-feature-spec.md"
```

If no checklist exists, Spec Validator offers to generate a template from your spec.

### 3. Update Checklist as You Implement

Edit `.spec-checklist.yaml` and update status fields as you build features.

### 4. Validate Periodically

```
"Validate spec implementation"
```

Get a scored report showing what's done, what's missing, and what needs work.

### 5. Iterate Until Score >= 90

Fix issues, update checklist, re-validate. Aim for grade A (90+) before shipping.

---

## Architecture

### 4-Dimension Scoring (100 points total)

| Dimension | Points | What It Measures |
|-----------|--------|------------------|
| **Implementation Completeness** | 40 | Are FRs, NFRs, models, and APIs implemented? |
| **Implementation Quality** | 25 | Test coverage, edge cases, documentation |
| **Spec Adherence** | 20 | Does checklist match spec exactly? |
| **Progress Transparency** | 15 | Status tracking, notes, blocker management |

**Grade Scale**: A+ (95+), A (90+), B (75+), C (60+), D (50+), F (<50)

---

## Trigger Phrases

**English**:
- "validate spec implementation"
- "check if spec is implemented"
- "verify spec compliance"
- "how much of the spec is done?"

**Korean**:
- "스펙 검증"
- "구현 확인"

---

## Validation Modes

**Full Validation** (~30 seconds, all 4 dimensions):
```
"Validate my-feature-spec.md, full mode"
```

**Quick Validation** (~10 seconds, completeness + adherence only):
```
"Quick validation of my-feature-spec.md"
```

**Requirements Only** (~15 seconds, FR/NFR progress only):
```
"Validate requirements only"
```

---

## Checklist Format

Implementation checklists use YAML format:

```yaml
spec_name: "my-feature"
last_updated: "2026-02-13"
validation_history: []

functional_requirements:
  - id: "FR-1"
    title: "User Authentication"
    status: "completed"           # completed | in_progress | not_started | blocked
    priority: "High"              # High | Medium | Low
    implementation_notes: "JWT-based auth using passport.js"
    blockers: []
    test_status: "completed"
    test_notes: "Unit + E2E tests in auth.test.ts"

non_functional_requirements:
  - id: "NFR-1"
    title: "Performance - Response time <200ms"
    status: "completed"
    priority: "High"
    implementation_notes: "Implemented caching with Redis"
    blockers: []
    test_status: "completed"

data_models:
  - name: "User"
    status: "completed"
    fields_implemented: ["id", "email", "password", "created_at"]
    fields_missing: []
    notes: "All fields from spec"

api_endpoints:
  - endpoint: "GET /api/users"
    status: "completed"
    test_status: "completed"
    notes: "Pagination implemented"

edge_cases:
  - title: "Concurrent edits"
    status: "completed"
    implementation_approach: "Optimistic locking with version field"
    test_status: "completed"

test_coverage:
  unit_tests: 85
  integration_tests: 75
  e2e_tests: 70
  overall: 78
```

**See `templates/checklist-template.yaml` for annotated example.**

---

## Configuration

Customize scoring weights, thresholds, and behavior in `skills/spec-validator/config.yaml`.

### Common Customizations

**Adjust dimension weights**:
```yaml
scoring:
  dimension_1_weight: 50  # Prioritize completeness
  dimension_2_weight: 20
  dimension_3_weight: 20
  dimension_4_weight: 10
```

**Change test coverage weights**:
```yaml
test_coverage_weights:
  unit_tests: 0.5       # More emphasis on unit tests
  integration_tests: 0.3
  e2e_tests: 0.2
```

See `skills/spec-validator/config.yaml` for all options.

---

## Integration with Spec-Interview

Complete workflow:

1. **Gather Requirements** (spec-interview):
   ```
   "Interview me about my authentication system"
   → Generates: auth-system-spec.md
   ```

2. **Generate Checklist** (spec-validator):
   ```
   "Validate auth-system-spec.md"
   → Generates: .spec-checklist.yaml
   ```

3. **Implement & Track**:
   - Build features
   - Update checklist status
   - Run periodic validations

4. **Ship when Ready**:
   - Score >= 90 (Grade A)
   - All High-priority items completed
   - Test coverage >= 80%

---

## Best Practices

### 1. Validate Frequently

Don't wait until everything is done. Validate after each major milestone to track progress.

### 2. Update Checklist Immediately

Update status right after implementing each feature, not in bulk later.

### 3. Document as You Go

Add implementation notes during development, not retroactively.

### 4. Prioritize High-Value Fixes

Focus on low-effort, high-point improvements first (e.g., adding documentation).

### 5. Aim for Grade A Before Shipping

Minimum threshold: Score >= 90 ensures quality and completeness.

---

## Troubleshooting

### Issue: "Spec file not found"

Use absolute or relative paths:
```
"Validate /full/path/to/my-feature-spec.md"
```

### Issue: "No requirements found in spec"

Ensure requirements use `FR-X` and `NFR-X` patterns:
- Headers: `#### FR-1: Title`
- Tables: `| FR-1 | Title | Priority |`
- Lists: `- **FR-1**: Title`

### Issue: "Invalid YAML in checklist"

Check for syntax errors (indentation, quotes, brackets).

### Issue: Score lower than expected

Review validation report's "Issues by Severity" section for specific problems.

---

## Files and Templates

- `skills/spec-validator/SKILL.md` - Detailed execution algorithm
- `skills/spec-validator/config.yaml` - Customizable configuration
- `templates/checklist-template.yaml` - Annotated checklist example
- `templates/validation-report-template.md` - Report structure
- `templates/fix-guide.md` - How to fix common issues
- `CLAUDE.md` - Developer documentation

---

## Related Plugins

- **spec-interview**: Create specifications through AI-driven interviews
- **project-insight**: Analyze codebase to understand implementation
- **learning-summary**: Document learnings from validation process

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/JayKim88/claude-ai-engineering/issues
- See `templates/fix-guide.md` for solutions to common problems
- See `CLAUDE.md` for technical details

---

**Version**: 1.0.0
**License**: MIT
**Author**: jaykim
