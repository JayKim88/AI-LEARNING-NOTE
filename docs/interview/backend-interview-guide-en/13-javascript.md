# 13. JavaScript Core

### Why This Section Matters

JavaScript interviews at AI startups focus on the parts that cause production bugs and performance issues — the event loop, closures, prototype chains, and the async model. These aren't academic — misunderstanding `this` binding or microtask ordering causes real bugs in React components, API handlers, and async pipelines.

JavaScript is also the runtime under Next.js and Node.js, so interviewers use JS fundamentals to probe whether you understand *why* things work, not just that they work.

**What interviewers actually probe:**
- What is the event loop and how do microtasks vs macrotasks differ?
- What does `this` refer to in arrow functions vs regular functions?
- What is a closure and what are the practical memory implications?
- What's the difference between `==` and `===`, and when does type coercion bite you?

---

## 13.1 The Event Loop — Microtasks vs Macrotasks

JavaScript is single-threaded. The event loop processes tasks from a queue. Understanding the *order* of execution is crucial for reasoning about async behavior.

```
┌─────────────────────────────────────────┐
│  Call Stack (synchronous code)          │
└───────────────────┬─────────────────────┘
                    │ empty?
                    ▼
┌─────────────────────────────────────────┐
│  Microtask Queue (high priority)        │  ← Promises, queueMicrotask, MutationObserver
│  Drain completely before next macrotask │
└───────────────────┬─────────────────────┘
                    │ empty?
                    ▼
┌─────────────────────────────────────────┐
│  Macrotask Queue (low priority)         │  ← setTimeout, setInterval, I/O callbacks
│  Process one at a time                  │
└─────────────────────────────────────────┘
```

The key rule: **microtask queue drains completely after every call stack frame before the next macrotask runs**.

```javascript
console.log("1 - sync");

setTimeout(() => console.log("4 - macrotask"), 0);

Promise.resolve().then(() => console.log("3 - microtask"));

console.log("2 - sync");

// Output: 1, 2, 3, 4
// "3 - microtask" runs before "4 - macrotask" even though setTimeout(0)
```

**Why this matters in practice:** If you have a Promise-heavy chain followed by a UI update or I/O callback, the Promises always resolve first. Misunderstanding this order causes "why is my state stale?" bugs in React when mixing async state updates with synchronous DOM reads.

---

## 13.2 Closures — What They Are and Where They Bite

A closure is a function that captures variables from its enclosing scope at the time of definition — and keeps them alive as long as the function exists.

```javascript
function makeCounter() {
    let count = 0;                // count lives as long as increment does

    return function increment() {
        count++;
        return count;
    };
}

const counter = makeCounter();
counter(); // 1
counter(); // 2
counter(); // 3
// count is not accessible from outside, but increment can still read and modify it
```

**The classic closure bug:**

```javascript
// ❌ All timeouts print 5 — they all close over the same `i` variable
for (var i = 0; i < 5; i++) {
    setTimeout(() => console.log(i), 100);
}
// Output: 5 5 5 5 5

// ✅ let creates a new binding per iteration
for (let i = 0; i < 5; i++) {
    setTimeout(() => console.log(i), 100);
}
// Output: 0 1 2 3 4
```

**Memory implication:** Closures prevent garbage collection of the captured variables. A closure that captures a large object or array keeps it alive indefinitely. Common memory leak pattern: event listeners that capture component state and are never removed.

```javascript
// Memory leak — listener captures `data` forever even after component unmounts
function setup(data) {
    document.addEventListener("click", () => console.log(data));
    // If this listener is never removed, `data` is never freed
}
```

---

## 13.3 `this` Binding

`this` is one of JavaScript's most confusing features because it's determined by *how a function is called*, not where it's defined — except for arrow functions.

**Regular functions — `this` depends on call site:**

```javascript
const obj = {
    name: "Nativ",
    greet: function() {
        console.log(this.name);   // "this" = the object calling the method
    }
};

obj.greet();              // "Nativ"
const fn = obj.greet;
fn();                     // undefined — "this" is now global (or undefined in strict mode)
```

**Arrow functions — `this` is lexically bound (inherited from enclosing scope):**

```javascript
const obj = {
    name: "Nativ",
    greet: () => {
        console.log(this.name);   // "this" = outer scope, NOT obj
    }
};

obj.greet();              // undefined — arrow function doesn't have its own "this"
```

**The practical rule:** Use arrow functions for callbacks inside class methods when you want to preserve `this`:

```javascript
class Timer {
    count = 0;

    start() {
        // ❌ Regular function — "this" is undefined inside setTimeout callback
        setTimeout(function() { this.count++; }, 1000);  // TypeError

        // ✅ Arrow function — "this" = Timer instance (inherited from start())
        setTimeout(() => { this.count++; }, 1000);       // works
    }
}
```

**`bind`, `call`, `apply`** — explicit `this` binding:

```javascript
function greet(greeting) {
    return `${greeting}, ${this.name}`;
}

const user = { name: "Jay" };
greet.call(user, "Hello");          // "Hello, Jay"
greet.apply(user, ["Hello"]);       // "Hello, Jay"
const boundGreet = greet.bind(user);
boundGreet("Hi");                    // "Hi, Jay"
```

---

## 13.4 Promises and `async/await`

Promises represent a value that will be available in the future. `async/await` is syntactic sugar over Promises — an `async` function always returns a Promise, and `await` pauses the function until the Promise resolves.

```javascript
// These are equivalent:

// Promise chain
function fetchUser(id) {
    return fetch(`/api/users/${id}`)
        .then(res => res.json())
        .then(data => data.user)
        .catch(err => console.error(err));
}

// async/await
async function fetchUser(id) {
    try {
        const res = await fetch(`/api/users/${id}`);
        const data = await res.json();
        return data.user;
    } catch (err) {
        console.error(err);
    }
}
```

**`Promise.all` vs `Promise.allSettled`:**

```javascript
// Promise.all — concurrent, fails fast if any rejects
const [user, orders] = await Promise.all([
    fetchUser(id),
    fetchOrders(id),
]);

// Promise.allSettled — concurrent, waits for all regardless of failures
const results = await Promise.allSettled([fetchUser(id), fetchOrders(id)]);
for (const result of results) {
    if (result.status === "fulfilled") console.log(result.value);
    if (result.status === "rejected")  console.error(result.reason);
}
```

**Common mistake:** `await` inside a `forEach` doesn't work as expected — `forEach` doesn't await the Promises returned by the callback.

```javascript
// ❌ All fetches run concurrently, forEach returns before they complete
ids.forEach(async (id) => {
    await fetchUser(id);    // each await is independent, not sequential
});

// ✅ Sequential
for (const id of ids) {
    await fetchUser(id);
}

// ✅ Concurrent
await Promise.all(ids.map(id => fetchUser(id)));
```

---

## 13.5 Prototype Chain and Inheritance

JavaScript uses prototypal inheritance — every object has a `__proto__` link to its prototype. Property lookups traverse this chain.

```javascript
const animal = {
    breathe() { return "breathing"; }
};

const dog = Object.create(animal);
dog.bark = function() { return "woof"; };

dog.bark();     // "woof" — own property
dog.breathe();  // "breathing" — found on prototype (animal)
dog.toString(); // "[object Object]" — found on Object.prototype
```

`class` syntax is syntactic sugar over prototypes:

```javascript
class Animal {
    breathe() { return "breathing"; }
}

class Dog extends Animal {
    bark() { return "woof"; }
}

const d = new Dog();
d.bark();         // own method
d.breathe();      // inherited from Animal.prototype
d instanceof Dog;    // true
d instanceof Animal; // true
```

**Practical implication:** Prototype methods are shared across all instances — memory-efficient. Instance properties (in the constructor) are per-instance. Defining methods inside the constructor creates a new function per instance, which wastes memory for large numbers of objects.

---

## 13.6 Type Coercion — `==` vs `===`

`===` (strict equality) — no type coercion. Types must match.
`==` (loose equality) — coerces types before comparing. Produces surprising results.

```javascript
// ❌ Loose equality surprises
0 == false       // true — false coerces to 0
"" == false      // true — both coerce to 0
null == undefined // true — special rule
null == 0        // false — null only == undefined
[] == false      // true — [] → "" → 0, false → 0
[] == ![]        // true (one of JavaScript's famous quirks)

// ✅ Strict equality — no surprises
0 === false      // false
"" === false     // false
null === undefined // false
```

**Rule:** Always use `===` in production code. The only acceptable use of `==` is `value == null` to check for both `null` and `undefined` simultaneously.

---

## 13.7 Interview Answer Scripts

**Q: "Explain the JavaScript event loop."**

> "JavaScript is single-threaded — one call stack, one execution context at a time. When async operations complete (network requests, timers), their callbacks go into a queue. The event loop is a continuous loop that checks: is the call stack empty? If yes, process the next item from the queue. There are two queues with different priorities. The microtask queue — which holds Promise callbacks — is processed completely after every call stack frame, before the runtime checks the macrotask queue. Macrotasks (setTimeout callbacks, I/O) are processed one at a time. This is why a resolved Promise's `.then` always runs before a `setTimeout(0)` — different queues, microtasks win."

**Q: "What is a closure and when does it cause memory leaks?"**

> "A closure is a function that captures variables from its enclosing scope and keeps them alive. The captured variables aren't freed as long as the closure exists — even after the outer function returns. This is powerful for encapsulation and factory patterns, but it causes memory leaks when the closure outlives what it's capturing. The classic example: an event listener that closes over a large object. If the listener is attached to a global DOM element and never removed — even after the React component that created it unmounts — the captured state stays in memory forever. The fix is always to remove event listeners in cleanup functions (`useEffect` return value in React), and to be conscious of what long-lived functions are capturing."

**Q: "What's the difference between arrow functions and regular functions for `this`?"**

> "Regular functions have their own `this` determined by how they're called — `obj.method()` sets `this` to `obj`, but detaching the method and calling it as a standalone function sets `this` to `undefined` in strict mode. Arrow functions don't have their own `this` at all — they inherit `this` from the enclosing lexical scope where they were defined. The practical implication in class methods: if you pass a method as a callback to `setTimeout` or an event listener, and that callback uses `this`, you need it to be an arrow function — otherwise `this` is undefined when the callback fires. The rule: use arrow functions for callbacks that need to reference the class instance; use regular functions for methods that should be callable as standalone functions."

**Q: "What's the difference between `Promise.all` and `Promise.allSettled`?"**

> "`Promise.all` runs all Promises concurrently and resolves when all succeed — but if any one rejects, the whole thing rejects immediately ('fail fast'). The other Promises continue to run but their results are ignored. `Promise.allSettled` also runs concurrently, but waits for every Promise to either resolve or reject before returning. Each result includes a `status` field — 'fulfilled' or 'rejected' — and you handle each individually. Use `Promise.all` when all results are required and a single failure means the whole operation is invalid (fetching user + permissions for an auth check). Use `Promise.allSettled` when partial success is acceptable and you want to handle each failure independently (batch processing items where some may fail)."

---

## 13.8 Self-Tests

Try answering these before looking at the answers.

1. What is the output order of this code, and why?
   ```javascript
   setTimeout(() => console.log("A"), 0);
   Promise.resolve().then(() => console.log("B"));
   queueMicrotask(() => console.log("C"));
   console.log("D");
   ```
2. A React component attaches a `mousemove` event listener on `window` in a `useEffect` with an empty dependency array. The handler uses state variables via a closure. The component unmounts. What goes wrong?
3. You write `const fn = obj.greet` and then call `fn()`. Inside `fn`, `this.name` is `undefined`. What's happening and what are two ways to fix it?
4. You want to process 100 API calls concurrently, but crash if more than 10 fail. Which Promise method do you use and why?
5. `typeof null` returns `"object"`. Why is this, and how do you check for actual null?

<details>
<summary>Answers</summary>

1. Output order: **D, B, C, A**. Explanation: `setTimeout` enqueues a macrotask. `Promise.resolve().then` enqueues a microtask. `queueMicrotask` also enqueues a microtask. `console.log("D")` is synchronous — runs first. Then the microtask queue drains: B then C (in registration order). Then the macrotask fires: A. Note that `queueMicrotask` and `Promise.resolve().then` are equivalent in priority — both are microtasks, first-registered fires first.

2. Two bugs: (a) **Memory leak** — the event listener holds a reference to the component's closure (including all state variables). Even after unmount, the listener is still attached to `window`, so the component can't be garbage collected. (b) **Stale closure** — the listener was created with the initial state value and captures it by closure. When state updates, the listener still reads the old value. Fix: return a cleanup function from `useEffect` that calls `window.removeEventListener(...)`, and ensure the handler is recreated when relevant state changes (or use `useRef` for the latest state value inside the handler).

3. When you write `const fn = obj.greet`, you detach the function from its object — `this` is no longer bound to `obj`. When called as `fn()` in strict mode, `this` is `undefined`. Fix option 1: `const fn = obj.greet.bind(obj)` — explicitly bind `this` to `obj`. Fix option 2: define `greet` as an arrow function in the class or object: `greet = () => { console.log(this.name); }` — arrow functions inherit `this` from the enclosing scope (the object or class instance) and can't be rebound.

4. Neither `Promise.all` nor `Promise.allSettled` directly. `Promise.all` fails on the first rejection. `Promise.allSettled` doesn't fail at all. You need a custom approach: use `Promise.allSettled` to run all 100 concurrently, then filter the results by status, count failures, and throw an error if the count exceeds 10. Alternatively, use a library like `p-limit` with `Promise.allSettled` for both concurrency limiting and custom failure thresholds.

5. `typeof null === "object"` is a historical JavaScript bug — null was represented with a type tag of 0 (object type) in the original implementation, and fixing it would break existing code. It was never corrected. To check for null: use strict equality `value === null`. Do not use `typeof value === "object"` — that also returns true for actual objects, arrays, and instances. The safe pattern for checking "null or undefined" together: `value == null` (loose equality, intentionally, this is the one accepted use case).

</details>

---

← Back to [12. Pydantic v2](12-pydantic.md) | Next → [14. TypeScript Advanced](14-typescript.md)
