# Test Traces for Memento

Copy and paste these JSON traces into the visualizer to test the ingestion layer.

## Trace 1: AI Trends Analysis
```json
[
  {"type":"thought","content":"User asked for trending AI topics."},
  {"type":"action","content":"fetch_trends()"},
  {"type":"observation","content":"AI agents, RAG search, synthetic data"},
  {"type":"output","content":"Top AI topics are Agents, RAG, Synthetic Data."}
]
```

## Trace 2: Restaurant Recommendation
```json
[
  {"type":"thought","content":"Start reasoning about best restaurant."},
  {"type":"thought","content":"Check user location."},
  {"type":"action","content":"maps.search('restaurants near Paris')"},
  {"type":"observation","content":"Returned 50 restaurants."},
  {"type":"output","content":"Recommendation: L'Ami Jean."}
]
```

## Trace 3: Support Ticket Classification
```json
[
  {"type":"thought","content":"Classify support ticket."},
  {"type":"action","content":"embeddings.search(ticket_text)"},
  {"type":"observation","content":"billing issue / card declined"},
  {"type":"thought","content":"User confused by renewal flow."},
  {"type":"action","content":"db.query('SELECT * FROM billing WHERE user_id=123')"},
  {"type":"observation","content":"payment method expired"},
  {"type":"output","content":"Ask user to update card."}
]
```

## Trace 4: Complex Nested Structure (LangChain-style)
```json
{
  "run_id": "langchain-123",
  "intermediate_steps": [
    {"type":"thought","content":"Planning the approach to solve this problem"},
    {"type":"action","content":"search_tool('best practices for authentication')"},
    {"type":"observation","content":"Found OAuth2 and JWT patterns"},
    {"type":"thought","content":"JWT seems most appropriate"},
    {"type":"output","content":"Recommend implementing JWT authentication"}
  ]
}
```

## Trace 5: With Confidence Scores
```json
[
  {"type":"thought","content":"Analyzing user sentiment","confidence":0.92},
  {"type":"action","content":"sentiment_analysis(text)","confidence":0.88},
  {"type":"observation","content":"Positive sentiment detected","confidence":0.95},
  {"type":"thought","content":"User is satisfied","confidence":0.45},
  {"type":"output","content":"Response: Thank you for your feedback!","confidence":0.89}
]
```

## Trace 6: With Timestamps
```json
[
  {"type":"thought","content":"Processing order request","timestamp":1700000000000},
  {"type":"action","content":"inventory.check(product_id)","timestamp":1700000001000},
  {"type":"observation","content":"Product in stock: 50 units","timestamp":1700000002000},
  {"type":"action","content":"payment.process(amount)","timestamp":1700000003000},
  {"type":"observation","content":"Payment successful","timestamp":1700000004000},
  {"type":"output","content":"Order confirmed","timestamp":1700000005000}
]
```

## Supported JSON Formats

The adapter handles:
- **Flat arrays**: `[{...}, {...}]`
- **Nested objects**: `{"steps": [...]}`, `{"trace": [...]}`, `{"nodes": [...]}`
- **LangChain-style**: `{"intermediate_steps": [...]}`
- **OpenAI-style**: `{"messages": [...]}`
- **Custom fields**: Automatically detects arrays in the JSON

## Auto-detected Fields

### Content
Looks for: `content`, `text`, `message`, `output`, `input`, `data`, `value`

### Type Detection (Keyword-based)
- **thought**: "thought", "thinking", "reason", "consider", "analyze", "plan"
- **action**: "action", "tool", "call", "execute", "run", "fetch", "search", "query"
- **observation**: "observation", "result", "response", "returned", "found"
- **output**: "final", "answer", "recommendation", "conclusion"
- **system**: "system", "internal", "log", "debug"

### IDs
Looks for: `id`, `step_id`, `nodeId`, `node_id`, `uuid`
Falls back to generated ID if not found

### Timestamps
Looks for: `timestamp`, `time`, `created_at`, `createdAt`, `start_time`

### Confidence
Looks for: `confidence`, `score`, `probability`, `certainty`
Automatically normalizes to 0-1 range

### Parent Relationships
Looks for: `parentId`, `parent_id`, `parent`, `parentNodeId`
Falls back to sequential linking (each step → previous step)
