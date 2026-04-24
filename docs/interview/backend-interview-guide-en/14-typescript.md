# 14. TypeScript Advanced

### Why This Section Matters

TypeScript at AI startups isn't just about "adding types." Interviewers test whether you can use the type system to make illegal states unrepresentable — not just annotate everything with `any`. The advanced features here (generics, discriminated unions, mapped types) are what separate someone who uses TypeScript from someone who understands it.

These patterns also come up directly when building API clients, state machines, and typed React hooks — all common in product engineering roles.

**What interviewers actually probe:**
- What is the difference between `interface` and `type`?
- How do generics work, and when would you use a generic constraint?
- What are discriminated unions and why are they better than optional fields?
- What are `keyof`, `typeof`, `Partial`, `Required`, `Pick`, `Omit`, `ReturnType`?

---

## 14.1 `interface` vs `type`

Both define the shape of an object, and both are nearly equivalent for simple cases. The key differences:

| | `interface` | `type` |
|---|---|---|
| Declaration merging | ✅ Yes — multiple declarations merge | ❌ No — duplicate name is an error |
| Extends | `extends` keyword | `&` (intersection) |
| Can represent unions | ❌ No | ✅ Yes (`type A = B \| C`) |
| Can represent primitives | ❌ No | ✅ Yes (`type ID = string`) |
| Best for | Object shapes, class contracts | Unions, intersections, aliases |

```typescript
// Interface — declaration merging (useful for extending library types)
interface User { name: string; }
interface User { age: number; }  // merges — User now has both name and age

// Type — cannot merge, but can union
type Status = "active" | "inactive" | "pending";  // interface cannot do this
type AdminUser = User & { role: "admin" };         // intersection
```

**Practical rule:** Use `interface` for object shapes that may need to be extended (especially React component props). Use `type` for unions, intersections, and type aliases. Don't agonize over the choice for simple cases — the difference only matters at the edges.

---

## 14.2 Generics — Reusable Type-Safe Code

Generics let you write a function or class that works with multiple types while preserving type safety. The type parameter (`T`) is a placeholder filled in at call time.

```typescript
// Without generics — loses type information
function first(arr: any[]): any {
    return arr[0];
}

// With generics — preserves type
function first<T>(arr: T[]): T | undefined {
    return arr[0];
}

const name = first(["Alice", "Bob"]);  // TypeScript infers: string | undefined
const num = first([1, 2, 3]);          // TypeScript infers: number | undefined
```

**Generic constraints — `extends`:**

```typescript
// T must have a .length property
function printLength<T extends { length: number }>(item: T): void {
    console.log(item.length);
}

printLength("hello");   // ✅ string has .length
printLength([1, 2, 3]); // ✅ array has .length
printLength(42);        // ❌ TypeScript error — number has no .length
```

**Generic with multiple type parameters:**

```typescript
// Map from one type to another
function mapKeys<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => { result[key] = obj[key]; });
    return result;
}
```

**Real-world pattern — typed API fetcher:**

```typescript
async function apiFetch<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as T;
}

const user = await apiFetch<User>("/api/user/1");  // TypeScript knows: User
```

---

## 14.3 Discriminated Unions — Making Illegal States Unrepresentable

A discriminated union is a union of types where each member has a *literal* type field that TypeScript uses to narrow the union. This is the TypeScript equivalent of Pydantic's discriminated unions.

```typescript
// ❌ Optional fields — illegal states are possible
interface Notification {
    type: "email" | "sms" | "push";
    recipient?: string;   // required for email and sms, not push
    deviceToken?: string; // required for push, not others
    message: string;
}
// Nothing prevents { type: "push", recipient: "..." } — inconsistent state

// ✅ Discriminated union — each variant is complete and correct
type EmailNotification = {
    type: "email";
    recipient: string;  // required
    subject: string;
    body: string;
};

type SMSNotification = {
    type: "sms";
    phone: string;      // required
    text: string;
};

type PushNotification = {
    type: "push";
    deviceToken: string; // required
    title: string;
};

type Notification = EmailNotification | SMSNotification | PushNotification;

function send(notification: Notification) {
    switch (notification.type) {
        case "email":
            // TypeScript narrows to EmailNotification here
            sendEmail(notification.recipient, notification.subject, notification.body);
            break;
        case "sms":
            sendSMS(notification.phone, notification.text);
            break;
        case "push":
            sendPush(notification.deviceToken, notification.title);
            break;
    }
}
```

**Exhaustiveness check with `never`:**

```typescript
function assertNever(x: never): never {
    throw new Error(`Unexpected value: ${x}`);
}

function send(notification: Notification) {
    switch (notification.type) {
        case "email": /* ... */ break;
        case "sms":   /* ... */ break;
        case "push":  /* ... */ break;
        default:
            assertNever(notification);  // TypeScript error if any case is missing
    }
}
```

If you add a new notification type to the union without handling it in the switch, TypeScript will flag the `assertNever` call as an error at compile time — before it reaches production.

---

## 14.4 Utility Types — Built-in Type Transformations

TypeScript ships with utility types that transform existing types. These come up constantly in real code.

```typescript
interface User {
    id: string;
    email: string;
    password: string;
    role: "admin" | "user";
    createdAt: Date;
}

// Partial — all fields optional (useful for update requests)
type UserUpdate = Partial<User>;

// Required — all fields mandatory (reverse of Partial)
type RequiredUser = Required<User>;

// Pick — keep only specified fields (useful for response shapes)
type UserPublic = Pick<User, "id" | "email" | "role">;

// Omit — exclude specified fields (useful for create requests without id)
type CreateUser = Omit<User, "id" | "createdAt">;

// Readonly — all fields read-only
type ImmutableUser = Readonly<User>;

// Record — build an object type from key and value types
type RolePermissions = Record<User["role"], string[]>;
// { admin: string[]; user: string[] }
```

**`keyof` and `typeof`:**

```typescript
// keyof — union of an object type's keys
type UserKey = keyof User;  // "id" | "email" | "password" | "role" | "createdAt"

// typeof — get the type of a value
const config = { port: 3000, host: "localhost" };
type Config = typeof config;  // { port: number; host: string }

// Combined: dynamically get a field's value
function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}
const email = getField(user, "email");  // TypeScript infers: string
```

**`ReturnType` and `Parameters`:**

```typescript
async function fetchUser(id: string): Promise<User> { /* ... */ }

type FetchUserReturn = Awaited<ReturnType<typeof fetchUser>>;  // User
type FetchUserParams = Parameters<typeof fetchUser>;           // [string]
```

---

## 14.5 Conditional Types and `infer`

Conditional types let you branch on type-level conditions. `infer` extracts a type from within another type.

```typescript
// Unwrap a Promise type
type Awaited<T> = T extends Promise<infer U> ? U : T;

type A = Awaited<Promise<string>>;   // string
type B = Awaited<number>;            // number (not a Promise — returns as-is)

// Extract array element type
type ArrayElement<T> = T extends (infer U)[] ? U : never;

type C = ArrayElement<string[]>;     // string
type D = ArrayElement<number>;       // never (not an array)
```

**Practical use — typed event emitter:**

```typescript
type EventMap = {
    "user:created": { userId: string; email: string };
    "order:placed": { orderId: string; total: number };
};

function on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
): void {
    // ...
}

on("user:created", (data) => {
    console.log(data.userId);  // TypeScript knows: string
    console.log(data.total);   // ❌ TypeScript error — total is not on user:created
});
```

---

## 14.6 Interview Answer Scripts

**Q: "What's the difference between `interface` and `type` in TypeScript?"**

> "For most cases they're interchangeable, but there are two key differences. Interfaces support declaration merging — you can declare the same interface twice and TypeScript merges them. This is useful when extending third-party library types. Types don't merge — a duplicate is a compiler error. The other difference is that types can represent anything: unions, intersections, primitives, tuples. Interfaces can only describe object shapes. My rule of thumb: use interfaces for object shapes, especially React props and API contract types; use types for unions, intersections, and aliases. When I'm designing a discriminated union for an AI pipeline's message types, that's a type. When I'm defining the props for a React component, that's an interface."

**Q: "Explain generics and when you'd use a constraint."**

> "Generics let you write code that works across types while preserving type information. A function like `function identity<T>(x: T): T` works for any type and TypeScript infers the return type from the input. Constraints let you restrict what T can be — `T extends { length: number }` means T must have a length property. The practical pattern I use most is a typed API fetcher: `async function apiFetch<T>(url: string): Promise<T>`. The call site specifies the expected type — `apiFetch<User>('/api/user')` — and TypeScript ensures the result is used as a User. This catches API shape mismatches at compile time, before runtime errors."

**Q: "What are discriminated unions and why are they better than optional fields?"**

> "A discriminated union is a union where each member has a literal type field that TypeScript uses to narrow the type. When you have optional fields instead — like `type: 'email' | 'sms', recipient?: string, phone?: string` — you've created an unrepresentable constraint: 'recipient is required when type is email.' TypeScript can't verify that — you'll get undefined at runtime. With a discriminated union, you model each variant as a separate type with all required fields, and TypeScript narrows correctly in switch statements. The killer feature is exhaustiveness: if you add a new variant to the union and forget to handle it in a switch, TypeScript flags an error at the `assertNever` call. That's a compile-time guarantee that your handler is complete."

**Q: "When would you use `Partial<T>` vs `Pick<T, K>` vs `Omit<T, K>`?"**

> "These are for sculpting derived types from a base type. `Partial<T>` makes all fields optional — useful for update (PATCH) request schemas where the client only sends changed fields. `Pick<T, K>` creates a new type with only the specified keys — useful for public response types that exclude sensitive fields like password or internal IDs. `Omit<T, K>` creates a new type without the specified keys — useful for create (POST) request schemas that exclude server-generated fields like `id` and `createdAt`. In Nativ, `UserResponse = Pick<User, 'id' | 'email' | 'role'>` ensures password never appears in API responses at the type level — a runtime mistake becomes a TypeScript error."

---

## 14.7 Self-Tests

Try answering these before looking at the answers.

1. You have `type Result<T> = { data: T; error: null } | { data: null; error: string }`. How would you write a function that takes a `Result<User>` and returns the user if successful, otherwise throws an error?
2. A colleague writes `function merge<T, U>(a: T, b: U): T & U`. What does the return type `T & U` mean, and what's a practical limitation of this typing?
3. You want a type `DeepPartial<T>` that makes all fields optional recursively (not just top-level). Write it using conditional types.
4. You use `ReturnType<typeof myFunc>` but `myFunc` is async. The result is `Promise<User>`. How do you get `User` as the type?
5. Your API response type has 15 fields. A colleague copies it and removes 3 fields to make a "public" version. Three months later, the base type gets a new field and the public version is forgotten. How would you design the types to prevent this?

<details>
<summary>Answers</summary>

1. TypeScript narrows the union via the `error` discriminant:
   ```typescript
   function unwrap<T>(result: Result<T>): T {
       if (result.error !== null) {
           throw new Error(result.error);  // TypeScript narrows: { data: null; error: string }
       }
       return result.data;                 // TypeScript narrows: { data: T; error: null }
   }
   ```
   This is the discriminated union pattern — `error: null` vs `error: string` is the discriminant. TypeScript knows in the `if` branch that `data` is null and `error` is a string; in the `else` branch, `data` is T.

2. `T & U` means an object that satisfies both T and U — all properties from both types. The practical limitation: `Object.assign(a, b)` at runtime does produce this shape, but TypeScript can't verify that the return value of the function actually satisfies `T & U` — it would need a cast. A more accurate signature uses `as T & U` in the implementation. Also, intersecting incompatible types (like `string & number`) produces `never`, which can be confusing. The return type says "this has all properties of T and U" but doesn't express precedence (what happens when T and U have the same key with different types — it becomes an intersection of those types, possibly `never`).

3. ```typescript
   type DeepPartial<T> = T extends object
       ? { [K in keyof T]?: DeepPartial<T[K]> }
       : T;
   ```
   Explanation: If T is an object, recursively apply DeepPartial to each value. If T is a primitive (string, number, boolean), return it as-is. The `?` makes each key optional. Note: this doesn't handle arrays specially — arrays are objects in TS, so `DeepPartial<string[]>` becomes `{ [K in keyof string[]?: DeepPartial<string> }` which is not what you want. For production, add an array branch: `T extends Array<infer U> ? Array<DeepPartial<U>> : ...`.

4. Use the built-in `Awaited` utility type: `type UserType = Awaited<ReturnType<typeof myFunc>>`. `Awaited<Promise<User>>` unwraps to `User`. This is exactly what `Awaited` is for — it recursively unwraps Promises. Alternatively, manually: `ReturnType<typeof myFunc> extends Promise<infer U> ? U : never`.

5. Use `Omit` to derive the public type from the base type: `type PublicUser = Omit<User, 'password' | 'internalId'>`. Now the public type is always derived from the base — when a new field is added to `User`, it automatically appears in `PublicUser` unless explicitly omitted. The colleague's approach (copy + manual remove) creates a diverging type that silently gets out of sync. The `Omit`-based approach creates a dependent type — the relationship is encoded in the type system. If you add a sensitive field later, add it to the Omit list and TypeScript enforces it everywhere `PublicUser` is used.

</details>

---

← Back to [13. JavaScript Core](13-javascript.md) | Next → [15. Node.js Backend](15-nodejs.md)
