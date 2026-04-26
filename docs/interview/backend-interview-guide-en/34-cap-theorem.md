# 34. CAP Theorem

### Why This Section Matters

CAP theorem comes up whenever you discuss distributed databases, microservices, or system design. It's a compact mental model for explaining why distributed systems force tradeoffs — and why there's no such thing as a perfect database that does everything.

Interviewers use it to test whether you understand *why* different databases behave differently under failure, not just which database to pick.

---

## 34.1 The Three Properties

**CAP theorem** states that a distributed data store can only guarantee **two of three** properties simultaneously:

| Property | What it means |
|----------|--------------|
| **Consistency (C)** | Every read returns the most recent write — or an error. All nodes see the same data at the same time. |
| **Availability (A)** | Every request receives a response (not an error) — but the response may not be the most recent data. |
| **Partition Tolerance (P)** | The system continues operating even when network messages between nodes are lost or delayed. |

---

## 34.2 Why You Always Have to Choose C or A

In a real distributed system, **network partitions are unavoidable**. Networks drop packets, nodes go offline, data centers lose connectivity. Partition tolerance is not optional — you must design for it.

This means the real tradeoff is:

```
When a network partition occurs:
  Do you return stale data (choose A)?
  Or do you return an error (choose C)?
```

There is no third option. Every distributed database answers this question in one of two ways.

---

## 34.3 CP vs AP Systems

**CP (Consistency + Partition Tolerance)**

Sacrifices availability when a partition occurs. The system returns an error rather than potentially stale data.

- When a node is unreachable, refuse to serve reads rather than risk returning outdated data.
- Better for: financial transactions, inventory counts, anything where correctness matters more than uptime.

Examples:
- **HBase** — refuses writes during partition
- **Zookeeper** — returns errors if quorum can't be reached
- **MongoDB** (default config) — primary election ensures consistency

**AP (Availability + Partition Tolerance)**

Sacrifices consistency when a partition occurs. The system keeps serving requests but may return stale data.

- When a node is unreachable, other nodes continue serving the last-known data.
- Better for: social media feeds, shopping carts, analytics — where a slightly stale read is acceptable.

Examples:
- **Cassandra** — always writable, eventual consistency
- **DynamoDB** (default) — highly available, eventually consistent reads
- **CouchDB** — multi-master, eventual consistency

---

## 34.4 "Eventual Consistency" Explained

AP systems use **eventual consistency**: if no new writes occur, all replicas will eventually converge to the same value.

```
Timeline:

t=0   User writes "price = $100" to node A
t=1   Node A → Node B replication starts (network is slow)
t=2   Another user reads from node B → gets old price "$90" ← stale read
t=3   Replication completes, node B now has "$100"
t=4   All reads from node B return "$100" ← converged
```

The window between t=2 and t=3 is the **inconsistency window**. AP systems accept this window; CP systems would have returned an error at t=2 instead.

---

## 34.5 Real-World Examples

| Database | Classification | Why |
|----------|---------------|-----|
| **PostgreSQL** (single node) | CA | Not distributed — CAP doesn't strictly apply |
| **PostgreSQL** (with replication) | CP | Primary stops accepting writes during partition |
| **Redis** (standalone) | CA | Single node |
| **Redis Cluster** | CP | Refuses writes if quorum lost |
| **Cassandra** | AP | Always writable, tunable consistency |
| **DynamoDB** | AP (default) | Eventually consistent reads by default; strongly consistent available |
| **MongoDB** | CP (default) | Primary-based writes, consistent reads |
| **Zookeeper** | CP | Quorum-based, refuses requests without majority |
| **CouchDB** | AP | Multi-master replication |

---

## 34.6 PACELC — The Extension

CAP only describes behavior *during* a partition. **PACELC** extends this to normal operation:

```
If Partition (P):
  tradeoff between Availability (A) and Consistency (C)
Else (E — normal operation):
  tradeoff between Latency (L) and Consistency (C)
```

Even without a partition, stronger consistency requires coordination between nodes — which adds latency. PACELC captures this:

| System | During Partition | Normal Operation |
|--------|-----------------|-----------------|
| Cassandra | AP | EL (low latency) |
| DynamoDB | AP | EL (low latency) |
| MongoDB | CP | EC (consistent) |
| Zookeeper | CP | EC (consistent) |

---

## 34.7 Practical Implications for AI Products

For typical AI products like Nativ, you're usually not building distributed databases — but you choose them. Here's how CAP maps to real decisions:

**Session / auth data** → CP (Redis Cluster or PostgreSQL)
User must always see their current login state. Stale auth data is a security risk.

**User preferences / settings** → AP acceptable
If a user's theme setting is stale for 100ms, nothing breaks.

**Payment / subscription state** → CP strictly
A user who cancelled their subscription must not see premium features due to stale data.

**Chat history / AI tutor conversation** → AP acceptable
A slight delay in seeing the latest message is fine. Availability matters more.

**RAG document index** → AP acceptable during indexing
New uploads may not be immediately searchable. Eventual consistency is fine.

---

## 34.8 Interview Answer Template

> "CAP theorem says a distributed system can only guarantee two of Consistency, Availability, and Partition Tolerance. Since partitions are unavoidable in real networks, the real choice is C vs A when a partition occurs.
>
> CP systems return errors rather than stale data — right for financial or auth systems. AP systems keep serving potentially stale data — right for social features or non-critical reads.
>
> In practice I think about this when choosing between PostgreSQL (CP) and Cassandra (AP) for a given data type, or when deciding whether to use Redis with eventual consistency or strong quorum reads."

---

## Summary

| Concept | One-line definition |
|---------|---------------------|
| **Consistency** | All nodes see the same data at the same time |
| **Availability** | Every request gets a response |
| **Partition Tolerance** | System works despite network failures |
| **CP** | Correct or error — never stale |
| **AP** | Always responds — but may be stale |
| **Eventual consistency** | All nodes converge to the same value given no new writes |
| **PACELC** | Extends CAP: also captures latency vs consistency in normal operation |
