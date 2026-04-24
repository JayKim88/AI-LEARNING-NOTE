# 24. LangChain / LangGraph

### Why This Section Matters

LangChain and LangGraph are the most widely adopted libraries for building LLM pipelines and agent systems. While using them isn't required, understanding what they do — and why they exist — is expected at AI-native companies. LangGraph in particular is becoming the standard for multi-agent and stateful agent workflows.

Interviewers probe whether you understand the abstraction value (and its costs), when to use the framework vs rolling your own, and how LangGraph's state machine model works.

**What interviewers actually probe:**
- What does LangChain actually provide and when would you use it?
- What is LangGraph and what problem does it solve that LangChain doesn't?
- What is a "state machine" in the context of AI agents?
- How do you implement human-in-the-loop with LangGraph?

---

## 24.1 LangChain — What It Provides

LangChain is a framework for building LLM-powered applications. Its core abstractions:

**1. LLMs / Chat Models — unified interface:**
```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

# Swap models without changing calling code
llm = ChatOpenAI(model="gpt-4o")
# llm = ChatAnthropic(model="claude-opus-4-7")

response = llm.invoke("What is Wanderlust?")
```

**2. Prompt Templates:**
```python
from langchain_core.prompts import ChatPromptTemplate

template = ChatPromptTemplate.from_messages([
    ("system", "You are a {language} language tutor."),
    ("user", "Explain: {word}"),
])

prompt = template.invoke({"language": "German", "word": "Wanderlust"})
```

**3. Output Parsers:**
```python
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel

class VocabExplanation(BaseModel):
    definition: str
    example: str

parser = JsonOutputParser(pydantic_object=VocabExplanation)
chain = template | llm | parser
result = chain.invoke({"language": "German", "word": "Wanderlust"})
# result is a VocabExplanation instance
```

**4. LCEL (LangChain Expression Language) — pipe operator:**
```python
# Chains are composed with | (pipe)
chain = prompt_template | llm | output_parser

# Equivalent to:
result = output_parser.invoke(llm.invoke(prompt_template.invoke(inputs)))
```

**5. Retrievers and Vector Store wrappers:**
```python
from langchain_community.vectorstores import PGVector
from langchain_openai import OpenAIEmbeddings

vector_store = PGVector(
    connection_string=DATABASE_URL,
    embedding_function=OpenAIEmbeddings(),
    collection_name="vocab_embeddings",
)

retriever = vector_store.as_retriever(search_kwargs={"k": 5})
results = retriever.invoke("German travel vocabulary")
```

**When LangChain is valuable:**
- Rapid prototyping — chain components together quickly
- Switching providers — same interface for OpenAI, Anthropic, local models
- Community integrations — 100s of pre-built tools (Tavily search, Wikipedia, SQL, Slack)

**When LangChain adds friction:**
- Simple pipelines where the abstraction adds no value over `openai.chat.completions.create`
- Production code where you need precise control over retries, caching, error handling
- Teams unfamiliar with LangChain — the abstraction has a learning curve

---

## 24.2 LangGraph — Stateful Agent Workflows

LangGraph is a separate library from LangChain that models agent workflows as a **state machine** — nodes are functions, edges define transitions, and state is passed between nodes.

**Why a state machine for agents?**

Simple LLM calls are stateless — input in, output out. But agents need:
- Persistent state across multiple LLM calls
- Conditional branching (did the tool call succeed? route differently if not)
- Loops (retry until a condition is met)
- Human-in-the-loop checkpoints
- Parallel execution of independent subtasks

LangGraph represents these as a directed graph with explicit state.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

# Define state shape
class AgentState(TypedDict):
    query: str
    retrieved_chunks: list[str]
    answer: str
    needs_clarification: bool

# Define nodes (functions that transform state)
def retrieve(state: AgentState) -> AgentState:
    chunks = vector_search(state["query"])
    return {"retrieved_chunks": chunks}

def generate(state: AgentState) -> AgentState:
    answer = llm_generate(state["query"], state["retrieved_chunks"])
    return {"answer": answer}

def check_quality(state: AgentState) -> str:
    # Routing function — returns the name of the next node
    if len(state["answer"]) < 20:
        return "needs_clarification"
    return "complete"

# Build the graph
workflow = StateGraph(AgentState)
workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_conditional_edges(
    "generate",
    check_quality,
    {
        "needs_clarification": "retrieve",  # loop back
        "complete": END,
    }
)

app = workflow.compile()
result = app.invoke({"query": "What is Wanderlust?"})
```

---

## 24.3 Human-in-the-Loop with LangGraph

LangGraph supports pausing the graph at a checkpoint to wait for human input or approval.

```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

class ReviewState(TypedDict):
    draft: str
    approved: bool
    feedback: str

def draft_content(state: ReviewState) -> ReviewState:
    draft = llm.invoke(f"Write a vocabulary explanation for: {state['query']}")
    return {"draft": draft.content}

def apply_feedback(state: ReviewState) -> ReviewState:
    revised = llm.invoke(f"Revise this: {state['draft']}\nFeedback: {state['feedback']}")
    return {"draft": revised.content}

workflow = StateGraph(ReviewState)
workflow.add_node("draft", draft_content)
workflow.add_node("revise", apply_feedback)
workflow.set_entry_point("draft")

# interrupt_before=["revise"] — pause here, wait for human input
workflow.add_edge("draft", "revise")

checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer, interrupt_before=["revise"])

# Run until the interrupt
config = {"configurable": {"thread_id": "review-1"}}
state = app.invoke({"query": "Wanderlust", "draft": "", "approved": False, "feedback": ""}, config)

# Pause here — human reviews state["draft"]
print("Draft:", state["draft"])

# Resume with feedback
app.update_state(config, {"feedback": "Make it shorter and add an example."})
final_state = app.invoke(None, config)
```

---

## 24.4 Multi-Agent Systems with LangGraph

LangGraph can model multiple specialized agents with routing logic:

```python
# Supervisor pattern — a routing agent dispatches to specialist agents
class SupervisorState(TypedDict):
    task: str
    result: str
    next_agent: str

def supervisor(state: SupervisorState) -> SupervisorState:
    # Supervisor decides which agent to use
    response = llm.invoke(
        f"Task: {state['task']}\nWhich agent: researcher, writer, or fact_checker?"
    )
    return {"next_agent": response.content.strip()}

def route_to_agent(state: SupervisorState) -> str:
    return state["next_agent"]

workflow = StateGraph(SupervisorState)
workflow.add_node("supervisor", supervisor)
workflow.add_node("researcher", researcher_agent)
workflow.add_node("writer", writer_agent)
workflow.add_node("fact_checker", fact_checker_agent)

workflow.add_conditional_edges(
    "supervisor",
    route_to_agent,
    {"researcher": "researcher", "writer": "writer", "fact_checker": "fact_checker"}
)
# Each agent edges back to supervisor or END
```

---

## 24.5 LangSmith — Observability

LangSmith is LangChain's observability platform for LLM applications — trace every LLM call, see inputs/outputs, measure latency and cost.

```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "..."

# All LangChain/LangGraph calls are automatically traced
result = app.invoke({"query": "What is Wanderlust?"})
# View in LangSmith: inputs, outputs, latency, token counts per node
```

This is the difference between debugging LLM issues by printing to stdout vs having structured traces with full context.

---

## 24.6 Interview Answer Scripts

**Q: "What is LangGraph and how is it different from LangChain?"**

> "LangChain is a library of components for building LLM pipelines — prompt templates, output parsers, retrievers, tool wrappers. You compose them into chains with the pipe operator. It's good for linear pipelines. LangGraph builds on top of LangChain to add stateful, conditional, and cyclic workflows. It represents agent logic as a directed graph: nodes are functions that transform state, edges define transitions, and conditional edges support branching and loops. A simple Q&A chain in LangChain is a straight pipeline. A research agent that retrieves information, checks quality, retries if insufficient, and pauses for human review — that's a graph with loops and conditional routing. LangGraph also has built-in checkpointing for persistence and human-in-the-loop interrupts. Conceptually, it's the difference between a pipeline and a state machine."

**Q: "When would you use LangChain/LangGraph vs building directly with the OpenAI SDK?"**

> "For simple, linear pipelines — a prompt template, one LLM call, parse output — I'd use the OpenAI SDK directly. The abstraction adds no value for a two-step chain. Where LangChain/LangGraph pays off: agent loops (need to retry, branch, loop until a condition is met), multi-provider setups (A/B testing Claude vs GPT-4o with the same codebase), built-in tool integrations (web search, SQL, file reading), and observability via LangSmith. LangGraph specifically makes sense when the agent workflow has human checkpoints, parallel branches, or persistent state across sessions — things that would require significant custom state management otherwise. The honest counter: LangChain adds a learning curve and debugging complexity. For a team not already using it, the build-your-own approach is often faster to ship and easier to reason about."

**Q: "What is a state machine in the context of AI agents?"**

> "A state machine is a model where the system is always in a defined state, and transitions between states are triggered by events or conditions. In LangGraph, the 'state' is a TypedDict — the accumulated information from all previous steps. Each node function reads state, performs work (calls an LLM, queries a database), and returns state updates. Edges define what node runs next. Conditional edges add branching: after a 'quality check' node, route to 'done' or 'retry' based on the result. This makes complex agent behavior explicit and debuggable — instead of a pile of async functions calling each other, you have a diagram of the workflow. You can pause the state machine at any node, inspect the full state, modify it, and resume. That's what human-in-the-loop is built on."

**Q: "What are the risks of building autonomous AI agents, and how do you mitigate them?"**

> "Three main risks. First, runaway tool use — an agent in a loop can keep calling tools indefinitely, accumulating cost and side effects. Mitigation: set a hard limit on the number of steps (`recursion_limit` in LangGraph), and add a budget tracker that terminates if cost exceeds a threshold. Second, irreversible actions — an agent that can send emails, delete files, or execute code can cause permanent damage from a bad plan. Mitigation: human-in-the-loop checkpoints before any destructive action; prefer read operations where possible; test in a sandboxed environment first. Third, prompt injection via tool results — tool output (web search results, file contents) can contain adversarial text that hijacks the agent's behavior. Mitigation: treat all tool results as untrusted user input; validate outputs before including them in the next prompt; separate instruction context from data context structurally. The rule for production agents: start with minimal permissions and add capabilities as they're proven safe."

---

## 24.7 Self-Tests

Try answering these before looking at the answers.

1. You have a LangGraph workflow that calls an external API in a node. The API is flaky and fails 20% of the time. How do you implement retry logic within the graph?
2. Your agent workflow has two independent steps: fetching user profile data and fetching recent activity. Currently they run sequentially. How do you run them in parallel with LangGraph?
3. You're debugging why the LLM returned unexpected output. Without LangSmith, what information would you log? With LangSmith, what additional visibility do you get?
4. A colleague argues that LangChain is "too much abstraction" and prefers raw API calls. You're building a system that needs to switch between GPT-4o and Claude based on load and cost. Who has the stronger argument?
5. Your LangGraph agent has a `supervisor` node that routes to specialist agents. The supervisor's routing LLM call costs $0.01 per request. At 10,000 requests/day, is this acceptable? What optimization would you consider?

<details>
<summary>Answers</summary>

1. Three approaches: (a) **Retry inside the node** — wrap the API call in a try/except with a retry loop. The node retries internally without re-entering the graph. (b) **Conditional edge to a retry node** — after the API node, add a conditional edge: if the call succeeded, go to the next step; if it failed, go back to the same node (creating a loop). Add a `retry_count` field to the state and a maximum retry limit to prevent infinite loops. (c) Use the `tenacity` library for exponential backoff inside the node. Approach (b) is more transparent — the retry is visible in the graph, and you can add side effects like alerting when the retry limit is hit.

2. LangGraph supports parallel node execution with `Send` or by using `asyncio.gather` inside a single node. The idiomatic LangGraph approach: create a "fan-out" node that dispatches to parallel branches, then a "fan-in" node that waits for both. Both profile and activity nodes execute concurrently. State is updated by each node independently. A simpler approach if the logic is straightforward: merge both calls into a single `fetch_context` node that calls `asyncio.gather(fetch_profile(), fetch_activity())` and returns both results. This is less "graph-pure" but simpler and just as fast.

3. **Without LangSmith:** Log the final prompt string (what was actually sent to the LLM after template rendering), the raw LLM response, and the parsed output. To debug, you'd reconstruct the conversation from logs. **With LangSmith:** Full trace of every node in the graph, including: input state entering each node, the exact prompt (rendered), the LLM response, token counts and latency per call, tool call requests and responses, and the output state leaving each node. You can replay the exact call in the LangSmith playground to test different prompts. The key difference is structure — logs are text you parse; LangSmith is structured data you navigate.

4. For the multi-provider use case, LangChain has the stronger argument. Switching between GPT-4o and Claude without LangChain requires: different SDK imports (`from openai import OpenAI` vs `from anthropic import Anthropic`), different message format handling, different streaming API shapes, and different error types. With LangChain: `llm = ChatOpenAI()` or `llm = ChatAnthropic()` — the calling code is identical. Adding a routing layer (`llm = route_to_model(load_metric)`) is a single line change. The colleague's "too much abstraction" argument is valid for a single-provider setup, but multi-provider support is exactly the problem LangChain was designed to solve.

5. $0.01 × 10,000 = $100/day just for routing decisions. This is significant. Optimization options: (a) **Replace LLM routing with rule-based routing** — if the task type is deterministic (user explicitly selects "research" or "write"), use a simple if/else. LLM routing is only worth the cost when the routing decision is genuinely complex. (b) **Use a cheaper model for the supervisor** — a smaller model (GPT-4o-mini at $0.15/1M vs $2.50/1M for GPT-4o) can handle routing decisions reliably for a ~15x cost reduction. (c) **Cache routing decisions** — if 80% of requests fall into the same category, cache the routing classification for identical or similar task descriptions using semantic caching.

</details>

---

← Back to [23. RAG Systems Deep Dive](23-rag.md) | Next → [25. Data Structures Quick Reference](25-data-structures.md)
