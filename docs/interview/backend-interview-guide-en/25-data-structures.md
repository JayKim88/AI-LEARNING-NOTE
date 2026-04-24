# 25. Data Structures Quick Reference

### Why This Section Matters

Data structure questions at AI startup interviews are not FAANG-style algorithmic hazing. They test whether you make reasonable decisions in code — choosing the right collection type, understanding time complexity for realistic operations, and recognizing when a specialized structure solves a real problem.

The focus here is practical: what does each structure do well, when do you reach for it, and what are the gotchas.

**What interviewers actually probe:**
- When would you use a set vs a list?
- What is the time complexity of dict lookup in Python?
- How does a heap (priority queue) work and when do you need it?
- Why is a deque better than a list for queue operations?

---

## 25.1 Arrays / Lists — The Default Collection

Python lists are dynamic arrays — contiguous memory, O(1) random access, O(n) insertion in the middle.

| Operation | Time complexity | Notes |
|-----------|----------------|-------|
| Access by index | O(1) | Contiguous memory |
| Append to end | O(1) amortized | Occasional O(n) resize |
| Insert at position | O(n) | Shift elements right |
| Delete at position | O(n) | Shift elements left |
| Search (unsorted) | O(n) | Linear scan |
| Search (sorted) | O(log n) | Binary search |

```python
items = [1, 2, 3, 4, 5]
items[2]           # O(1) — index access
items.append(6)    # O(1) amortized — add to end
items.insert(2, 9) # O(n) — insert at position 2, shifts elements right
items.pop(2)       # O(n) — remove at position 2
items.pop()        # O(1) — remove from end
```

**Use lists when:** You need ordered, indexed access or you're appending to the end.

---

## 25.2 Hash Maps / Dicts — O(1) Lookup

Python dicts are hash tables — keys are hashed to bucket positions. Average O(1) for get/set/delete.

```python
d = {"alice": 30, "bob": 25}
d["alice"]          # O(1) average
d["carol"] = 35     # O(1) average
"alice" in d        # O(1) — hash table membership
del d["alice"]      # O(1) average

# Defaultdict — avoids KeyError, auto-initializes
from collections import defaultdict
word_count = defaultdict(int)
for word in text.split():
    word_count[word] += 1  # no KeyError if word is new

# Counter — dict subclass for counting
from collections import Counter
counter = Counter(["a", "b", "a", "c", "b", "a"])
counter.most_common(2)  # [("a", 3), ("b", 2)]
```

**Use dicts when:** You need O(1) lookup by key, frequency counting, memoization, or grouping by a key.

**Hash collision:** In rare cases, many keys hash to the same bucket — O(n) lookup in the worst case. Python's dict implementation resizes and rehashes to keep collisions rare.

---

## 25.3 Sets — O(1) Membership Testing

Sets are hash tables for values (not key-value pairs). O(1) add, remove, and membership check. Unordered, no duplicates.

```python
seen = set()
seen.add("alice")
"alice" in seen      # O(1) — vs O(n) for list
seen.remove("alice") # O(1)

# Set operations
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
a | b    # union: {1, 2, 3, 4, 5, 6}
a & b    # intersection: {3, 4}
a - b    # difference: {1, 2}
a ^ b    # symmetric difference: {1, 2, 5, 6}
```

**Use sets when:** Deduplication, membership testing (is X in this collection?), or set algebra (intersection, union, difference).

**Common mistake:** `item in my_list` is O(n). Convert to a set first if you're doing many membership checks:
```python
# ❌ O(n) per check — O(n²) total
for item in items:
    if item in large_list:  # O(n) each time
        ...

# ✅ O(1) per check after O(n) set construction
large_set = set(large_list)
for item in items:
    if item in large_set:  # O(1)
        ...
```

---

## 25.4 Queues and Deques

A queue is first-in, first-out (FIFO). Using a Python list as a queue is O(n) per pop from the front — `list.pop(0)` shifts all elements.

**Use `collections.deque`** — O(1) append and pop from both ends:

```python
from collections import deque

queue = deque()
queue.append("task1")    # enqueue — O(1)
queue.append("task2")
queue.popleft()          # dequeue — O(1) (list.pop(0) would be O(n))

# Deque as a fixed-size sliding window
window = deque(maxlen=5)  # auto-drops oldest when full
for item in stream:
    window.append(item)   # keeps last 5 items
```

---

## 25.5 Heaps — Priority Queues

A heap is a complete binary tree where each parent is smaller (min-heap) or larger (max-heap) than its children. In Python, `heapq` implements a min-heap.

Heaps support: O(1) peek at min, O(log n) insert, O(log n) extract min.

```python
import heapq

# Min-heap — smallest element at index 0
heap = []
heapq.heappush(heap, 5)
heapq.heappush(heap, 1)
heapq.heappush(heap, 3)
heapq.heappop(heap)     # 1 (minimum)
heap[0]                 # 3 (peek without removing)

# Max-heap — negate values (Python only has min-heap)
max_heap = []
heapq.heappush(max_heap, -5)
heapq.heappush(max_heap, -1)
heapq.heappop(max_heap)     # -1, negate → 1 (was largest)

# Efficient: get k largest from n items
top_k = heapq.nlargest(3, [4, 1, 9, 2, 7, 3])  # [9, 7, 4]
```

**Use heaps when:** You need repeated access to the minimum or maximum, or implementing a scheduler, job queue, or Dijkstra's algorithm.

---

## 25.6 Linked Lists

A linked list is a chain of nodes where each node holds a value and a pointer to the next node. Python doesn't have a built-in linked list — you'd implement one or use `deque`.

| Operation | Time complexity |
|-----------|----------------|
| Access by index | O(n) |
| Insert at head | O(1) |
| Insert at tail (if tracked) | O(1) |
| Insert in middle | O(1) (once you have the node) |
| Search | O(n) |

**In practice:** Python lists and deques cover almost all linked list use cases. Linked lists appear in algorithm questions to test pointer manipulation.

```python
class Node:
    def __init__(self, val: int, next: "Node" = None):
        self.val = val
        self.next = next

def reverse_linked_list(head: Node) -> Node:
    prev, curr = None, head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
    return prev
```

---

## 25.7 Trees and Graphs

**Binary search tree (BST):** O(log n) search, insert, delete (balanced). Python doesn't have a built-in BST — use `sortedcontainers.SortedList` for practical needs.

**Trie (prefix tree):** Stores strings by shared prefixes. O(k) search where k = string length. Used for autocomplete, spell checking.

```python
class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_end: bool = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self.root
        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]
        return node.is_end
```

**Graph representations:**
- Adjacency list (dict of lists): space-efficient for sparse graphs
- Adjacency matrix (2D array): O(1) edge lookup, space-expensive for sparse

---

## 25.8 Complexity Cheat Sheet

| Structure | Access | Search | Insert | Delete | Space |
|-----------|--------|--------|--------|--------|-------|
| Array/List | O(1) | O(n) | O(n) | O(n) | O(n) |
| Dict/HashMap | — | O(1)* | O(1)* | O(1)* | O(n) |
| Set | — | O(1)* | O(1)* | O(1)* | O(n) |
| Deque | O(n) | O(n) | O(1) ends | O(1) ends | O(n) |
| Heap | O(1) min | O(n) | O(log n) | O(log n) | O(n) |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) | O(n) |

\* amortized average

---

## 25.9 Interview Answer Scripts

**Q: "Why use a deque instead of a list as a queue?"**

> "Python lists have O(1) append to the end but O(n) pop from the front — `list.pop(0)` shifts every element left. For a queue with frequent enqueue and dequeue operations, this is O(n) per dequeue — O(n²) total over n items. `collections.deque` is implemented as a doubly-linked list of blocks with O(1) append and pop from both ends. For any FIFO pattern, deque is the right choice. The only time a list is fine as a queue is when you process all items at once in a batch (collect all, iterate once) rather than enqueue/dequeue in a loop."

**Q: "How would you efficiently find the k largest items in a stream?"**

> "Use a min-heap of size k. Process each item: if the heap has fewer than k items, push. If the item is larger than the heap's minimum (heap[0]), pop the minimum and push the new item. After processing all n items, the heap contains the k largest. Time complexity: O(n log k) — n items, each requiring at most one heap operation at O(log k). Space: O(k). This is better than sorting the full stream at O(n log n). In Python: `heapq.nlargest(k, stream)` does exactly this, or you can implement it manually for a streaming case where you don't have all items upfront."

**Q: "When would you use a set instead of a list, and what's the tradeoff?"**

> "Use a set when you need fast membership testing or deduplication. `item in my_set` is O(1) average; `item in my_list` is O(n). For any check-if-exists operation on more than a handful of items, a set is the right structure. The tradeoff: sets are unordered (Python 3.7+ dicts preserve insertion order, but sets don't), elements must be hashable (no lists, dicts, or mutable objects), and sets use more memory than a sorted list due to hash table overhead. Common patterns: visited nodes in BFS/DFS (set for O(1) lookup), deduplication of a list (`list(set(items))`), and fast intersection/union operations. If you need ordered unique items: use `dict.fromkeys(items)` which preserves insertion order, or sort after deduplication."

**Q: "What is a hash collision and how does Python's dict handle it?"**

> "A hash collision occurs when two different keys produce the same hash value. Since Python's dict maps keys to positions using `hash(key) % table_size`, two keys with the same hash would map to the same slot. Python handles this with open addressing: if a slot is occupied, probe the next slot (using a pseudorandom probe sequence, not just +1 to avoid clustering). Lookup then checks each probed slot until it finds the key or an empty slot. This means worst-case dict lookup is O(n) — if many keys collide, you check many slots. In practice, Python's hash functions are good and table resizing keeps the load factor low (~66%), so average case is O(1). The practical implication: never use a poorly-distributed hash as a dict key in hot paths. Strings, ints, and tuples all have well-designed hash functions in Python."

---

## 25.10 Self-Tests

Try answering these before looking at the answers.

1. You need to check if each element in list A (10,000 items) appears in list B (50,000 items). How do you do it efficiently?
2. You're tracking the 3 most recent user actions. When a new action is added and there are already 3, the oldest drops off. Which data structure and which Python class?
3. You have a dict of word frequencies and want to find the 10 most common words. What is the most efficient approach?
4. A colleague sorts a list of 1 million items every time they need the minimum. What data structure would you suggest and why?
5. You want to implement an undo system (Ctrl+Z) that supports at most 50 levels of undo. What data structure and how do you implement the limit?

<details>
<summary>Answers</summary>

1. Convert list B to a set first. Set construction is O(n), and membership testing is O(1). Total: O(|B|) to build + O(|A|) for all lookups = O(|A| + |B|). Using `if item in list_b` directly is O(|A| × |B|) = O(500,000,000 operations) — roughly 500x slower. Code: `set_b = set(list_b); results = [item for item in list_a if item in set_b]`.

2. `collections.deque(maxlen=3)`. The `maxlen` parameter automatically discards the oldest item (left end) when a new item is appended to the right end and the deque is at capacity. This is exactly the sliding window pattern — O(1) append, automatic eviction, O(n) iteration. Code: `window = deque(maxlen=3); window.append(action)`.

3. `collections.Counter.most_common(10)`. Counter inherits from dict and `.most_common(n)` returns the n most common elements with their counts. Internally it uses `heapq.nlargest` — O(n log k) where k=10. This is more efficient than sorting all entries by frequency (O(n log n)) when k << n. Code: `Counter(word_frequencies).most_common(10)` — though if you already have a dict, `heapq.nlargest(10, word_freq.items(), key=lambda x: x[1])` works directly.

4. A **min-heap** (priority queue). Sorting 1 million items every time for the minimum is O(n log n) per access — wasteful if the only operation needed is "get minimum." With a heap: O(n) to build once, O(1) to peek at minimum, O(log n) to extract minimum or insert new items. If items are added/removed dynamically, the heap maintains the minimum invariant automatically. `heapq.heapify(items)` builds the heap in O(n); `heap[0]` peeks at minimum in O(1).

5. A **deque with maxlen=50** (or a regular list bounded to 50 items). The undo system is a stack — push state on action, pop to undo. Deque with `maxlen=50` auto-drops the oldest entry (furthest back in undo history) when capacity is reached, without any manual limit checking. Code: `undo_stack = deque(maxlen=50); undo_stack.append(current_state)` on action; `previous = undo_stack.pop()` on undo. If you want to preserve the full 50-level history and not implement redo, deque is cleanest. For a full undo/redo system, you'd maintain two stacks: undo stack (pop on Ctrl+Z, push to redo) and redo stack (pop on Ctrl+Y, push to undo).

</details>

---

← Back to [24. LangChain / LangGraph](24-langchain.md) | Next → [26. Algorithm Patterns](26-algorithms.md)
