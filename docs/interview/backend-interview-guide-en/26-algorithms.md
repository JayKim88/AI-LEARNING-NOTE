# 26. Algorithm Patterns (Easy–Medium)

### Why This Section Matters

At AI startup interviews, coding tests are typically take-home projects or 45-minute pair programming sessions — not LeetCode grind. But ~20% of rounds include a coding component testing common patterns. The goal isn't memorizing 300 problems; it's recognizing 8-10 patterns that cover the majority of easy-medium interview questions.

If you recognize the pattern, you can solve the problem. If you don't, no amount of grinding helps.

**What interviewers actually probe:**
- Can you recognize which pattern applies to a problem?
- Do you think about edge cases before coding?
- Can you discuss time/space complexity before being asked?

---

## 26.1 Two Pointers

**When to use:** Array or string problems where you need to find pairs, compare elements from both ends, or eliminate duplicates. Typically O(n) time, O(1) space.

**Template:**
```python
def two_sum_sorted(nums: list[int], target: int) -> tuple[int, int]:
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return (left, right)
        elif total < target:
            left += 1     # need larger sum — move left pointer right
        else:
            right -= 1    # need smaller sum — move right pointer left
    return (-1, -1)
```

**Classic problems:**
- Two Sum (sorted array)
- Remove duplicates from sorted array
- Valid Palindrome (`s[left] == s[right]`, move inward)
- Reverse a string in-place

---

## 26.2 Sliding Window

**When to use:** Subarray or substring problems asking for maximum/minimum/sum over a variable-length window. O(n) time — each element enters and exits the window once.

**Fixed-size window:**
```python
def max_sum_subarray(nums: list[int], k: int) -> int:
    window_sum = sum(nums[:k])
    max_sum = window_sum
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]   # add right, remove left
        max_sum = max(max_sum, window_sum)
    return max_sum
```

**Variable-size window:**
```python
def longest_substring_no_repeat(s: str) -> int:
    seen = {}         # char → last index seen
    left = 0
    max_len = 0
    for right, char in enumerate(s):
        if char in seen and seen[char] >= left:
            left = seen[char] + 1    # shrink window from left
        seen[char] = right
        max_len = max(max_len, right - left + 1)
    return max_len
```

---

## 26.3 Binary Search

**When to use:** Sorted array problems, or problems where the answer space is monotonic ("if X works, anything smaller works too"). O(log n) time.

**Template:**
```python
def binary_search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = left + (right - left) // 2   # avoids integer overflow
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1   # not found
```

**Search on answer space (bisect pattern):**
```python
# Find minimum capacity to ship packages in D days
def min_ship_capacity(weights: list[int], days: int) -> int:
    def can_ship(capacity: int) -> bool:
        day, current = 1, 0
        for w in weights:
            if current + w > capacity:
                day += 1
                current = 0
            current += w
        return day <= days

    left, right = max(weights), sum(weights)
    while left < right:
        mid = (left + right) // 2
        if can_ship(mid):
            right = mid        # try smaller capacity
        else:
            left = mid + 1     # need larger capacity
    return left
```

---

## 26.4 Depth-First Search (DFS)

**When to use:** Tree traversal, graph connectivity, path finding, combinations/permutations. O(V + E) for graphs.

**Recursive DFS on a tree:**
```python
def max_depth(root: TreeNode | None) -> int:
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
```

**DFS with backtracking — combinations:**
```python
def subsets(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(start: int, current: list[int]):
        result.append(current[:])   # add current subset
        for i in range(start, len(nums)):
            current.append(nums[i])
            backtrack(i + 1, current)  # recurse with next index
            current.pop()               # backtrack — remove last element

    backtrack(0, [])
    return result
```

**Iterative DFS with a stack:**
```python
def dfs_iterative(graph: dict, start: str) -> list[str]:
    visited = set()
    stack = [start]
    order = []
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                stack.append(neighbor)
    return order
```

---

## 26.5 Breadth-First Search (BFS)

**When to use:** Shortest path in unweighted graphs, level-order traversal, "minimum steps" problems. O(V + E).

```python
from collections import deque

def bfs_shortest_path(graph: dict, start: str, target: str) -> int:
    queue = deque([(start, 0)])   # (node, distance)
    visited = {start}

    while queue:
        node, dist = queue.popleft()
        if node == target:
            return dist
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, dist + 1))

    return -1   # not reachable
```

**Level-order traversal:**
```python
def level_order(root: TreeNode) -> list[list[int]]:
    if not root:
        return []
    result = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):    # process exactly current level
            node = queue.popleft()
            level.append(node.val)
            if node.left:  queue.append(node.left)
            if node.right: queue.append(node.right)
        result.append(level)
    return result
```

---

## 26.6 Dynamic Programming

**When to use:** Optimization problems (minimum/maximum) with overlapping subproblems. Think: "can I break this into subproblems whose results I can reuse?"

**Key insight:** Before coding, ask yourself: "What is the state? What is the recurrence relation?"

**Classic — Fibonacci (memoization):**
```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n <= 1: return n
    return fib(n - 1) + fib(n - 2)
```

**Classic — Coin change (bottom-up DP):**
```python
def coin_change(coins: list[int], amount: int) -> int:
    dp = [float("inf")] * (amount + 1)
    dp[0] = 0   # 0 coins needed to make amount 0

    for amt in range(1, amount + 1):
        for coin in coins:
            if coin <= amt:
                dp[amt] = min(dp[amt], dp[amt - coin] + 1)

    return dp[amount] if dp[amount] != float("inf") else -1
```

**Classic — Longest common subsequence:**
```python
def lcs(s1: str, s2: str) -> int:
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]
```

---

## 26.7 Hash Map Patterns

Hash maps appear in almost every problem as a way to trade space for time.

**Frequency counting:**
```python
def is_anagram(s: str, t: str) -> bool:
    if len(s) != len(t): return False
    return Counter(s) == Counter(t)
```

**Two-pass hash map — Two Sum:**
```python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}   # value → index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
```

**Grouping:**
```python
def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))   # canonical form of the anagram group
        groups[key].append(s)
    return list(groups.values())
```

---

## 26.8 Pattern Recognition Guide

| Problem description | Pattern |
|--------------------|---------|
| "Find pair/triplet that sums to X" (sorted) | Two pointers |
| "Longest/smallest subarray/substring with condition" | Sliding window |
| "Find X in sorted array" or "minimum that satisfies condition" | Binary search |
| "All paths / combinations / permutations" | DFS + backtracking |
| "Minimum steps / shortest path" | BFS |
| "Minimum/maximum over all possibilities" | Dynamic programming |
| "O(1) lookup / frequency / grouping" | Hash map |

---

## 26.9 Interview Answer Scripts

**Q: "Walk me through your approach to a coding problem."**

> "I start by understanding the input/output and constraints — what are the types, what are the size limits, what edge cases exist (empty input, single element, negative numbers)? Then I identify the pattern: is this a search problem, an optimization problem, a graph traversal? I state the naive solution first — usually O(n²) or O(n log n) — and then ask whether we can do better. For most problems, recognizing the right pattern (sliding window, two pointers, binary search) takes you from O(n²) to O(n). I code the solution, trace through an example by hand to verify, then check edge cases. I discuss time and space complexity before being asked — it shows I'm thinking about the full picture, not just 'does it work.'"

**Q: "Write a function to find the longest substring without repeating characters."**

> "This is a classic sliding window with a set. Maintain a window with left and right pointers and a set of characters in the current window. Expand right: if the character is not in the set, add it and update the max length. If it's already in the set, shrink from the left until the duplicate is removed. Python: `left = 0; seen = set(); max_len = 0`. For each right index, character `c`: while `c in seen`, remove `s[left]` from `seen`, increment left. Add `c` to `seen`, update `max_len = max(max_len, right - left + 1)`. Time O(n), space O(min(n, alphabet)). Edge cases: empty string returns 0; all same characters returns 1."

**Q: "Given a list of integers, find if there's a pair that sums to a target. The list is not sorted."**

> "Hash set approach for O(n) time. Iterate through the list: for each number, compute `complement = target - number`. If complement is already in the set, we found a pair — return True. Otherwise, add the current number to the set and continue. One pass through the list, O(1) set lookups. Time: O(n), Space: O(n) for the set. The tradeoff vs sorting + two pointers: sorting is O(n log n) but O(1) space (if in-place); hash set is O(n) time but O(n) space. If I had to find all pairs or the input was already sorted, I'd use two pointers. For a single existence check on an unsorted list, the hash set is the cleaner O(n) solution."

**Q: "How do you detect a cycle in a linked list?"**

> "Floyd's cycle detection — two pointers, slow and fast. Slow moves one step at a time; fast moves two. If there's a cycle, fast eventually laps slow and they meet — they'll be at the same node. If there's no cycle, fast reaches None. Time O(n), space O(1). The intuition: in a cycle, fast gains one step per iteration. If the cycle has length C, they'll meet within C iterations after fast enters the cycle. Common mistake: checking `fast == slow` before moving — you need to move first, then check. Also check `fast is not None` and `fast.next is not None` before moving fast two steps. Alternative: hash set tracking visited nodes — O(n) time and space, simpler to explain but uses more memory."

---

## 26.10 Self-Tests

Try answering these before looking at the answers.

1. You have a sorted array of integers. Find all pairs that sum to a target value. What's your approach and time complexity?
2. Given a string, find the length of the longest substring containing at most 2 distinct characters. Which pattern and what's the time complexity?
3. You need to find the first and last position of a target in a sorted array. Can you do better than O(n)?
4. Given a binary tree, check if it's a valid BST (left < node < right for all subtrees). What's your approach?
5. You have `n` coins and want to reach amount `k` using the fewest coins. There are unlimited coins of each denomination. What's the approach and complexity?

<details>
<summary>Answers</summary>

1. **Two pointers on the sorted array.** Set left pointer at index 0 and right pointer at the last index. Compute sum: if it equals target, record the pair and move both pointers inward; if less than target, move left right; if greater, move right left. Time: O(n) — each pointer moves inward at most n times. Space: O(1) (or O(k) for output). If array is unsorted: sort first O(n log n), then two pointers O(n) = O(n log n) total. Alternative for unsorted without sorting: hash set, O(n) time O(n) space.

2. **Sliding window** — variable size. Maintain a frequency map of characters in the window. Expand right; when distinct characters > 2, shrink from left until distinct ≤ 2. Track max window size. Time: O(n) — each character is added and removed from the window at most once. Space: O(1) — at most 3 characters in the frequency map (2 + 1 before shrinking). The key insight: the window is valid when `len(freq_map) <= 2`.

3. **Yes — binary search, O(log n).** Run binary search twice: once to find the leftmost occurrence (bias toward left — when target found, continue searching left half), once for the rightmost (bias toward right). Template: for leftmost, when `nums[mid] == target`, set `result = mid` and continue with `right = mid - 1`. For rightmost, when `nums[mid] == target`, set `result = mid` and continue with `left = mid + 1`. Total: two binary searches = O(2 log n) = O(log n). This is LeetCode 34 "Find First and Last Position" — a classic binary search variant.

4. **DFS with valid range tracking.** Recursively validate each node with an (min_val, max_val) range. Root: (-inf, +inf). Left child: (-inf, root.val). Right child: (root.val, +inf). At each node: if `min_val < node.val < max_val`, valid; recurse into left and right with tightened bounds. Return True only if both children are valid. Common mistake: only checking `left.val < node.val < right.val` without considering the full subtree — this misses cases where a left subtree has a node larger than a grandparent.

5. **Dynamic programming — coin change.** State: `dp[amount]` = minimum coins to make that amount. Base case: `dp[0] = 0`. Transition: for each amount from 1 to k, for each coin denomination c: `dp[amt] = min(dp[amt], dp[amt - c] + 1)` if `c <= amt`. Time: O(k × n) where n = number of coin denominations. Space: O(k) for the dp array. The greedy approach (always take the largest coin) doesn't work for arbitrary denominations — e.g., coins [1, 3, 4], target 6: greedy gives 4+1+1 = 3 coins, but optimal is 3+3 = 2 coins.

</details>

---

← Back to [25. Data Structures Quick Reference](25-data-structures.md) | Next → [27. Security (OWASP)](27-security.md)
