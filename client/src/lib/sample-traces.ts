export const SAMPLE_LANGGRAPH_TRACE = {
  "run_id": "lg-run-abc123",
  "langgraph_version": "0.1.0",
  "graph_id": "research_agent",
  "events": [
    {
      "id": "evt-001",
      "type": "ai_message",
      "timestamp": "2024-01-15T10:00:00Z",
      "content": "I'll help you research this topic. Let me start by searching for relevant information.",
      "role": "assistant"
    },
    {
      "id": "evt-002", 
      "type": "tool_call",
      "timestamp": "2024-01-15T10:00:05Z",
      "tool": "web_search",
      "tool_input": {"query": "latest AI research breakthroughs 2024"},
      "name": "web_search"
    },
    {
      "id": "evt-003",
      "type": "tool_result",
      "timestamp": "2024-01-15T10:00:10Z",
      "content": "Found 5 relevant articles about recent AI breakthroughs including GPT-4 Vision, Gemini, and Claude 3.",
      "observation": "Search results retrieved successfully"
    },
    {
      "id": "evt-004",
      "type": "ai_message", 
      "timestamp": "2024-01-15T10:00:15Z",
      "content": "Based on my research, I found several key developments. Let me summarize them for you.",
      "role": "assistant"
    },
    {
      "id": "evt-005",
      "type": "final_answer",
      "timestamp": "2024-01-15T10:00:20Z",
      "content": "Here are the top AI breakthroughs in 2024:\\n1. GPT-4 Vision - multimodal capabilities\\n2. Gemini - Google's advanced model\\n3. Claude 3 - improved reasoning",
      "is_final": true
    }
  ]
};

export const SAMPLE_LANGCHAIN_TRACE = {
  "run_id": "lc-run-xyz789",
  "langchain_version": "0.1.0",
  "intermediate_steps": [
    [
      {
        "tool": "Calculator",
        "tool_input": "25 * 4 + 100",
        "log": "I need to calculate this math expression"
      },
      "200"
    ],
    [
      {
        "tool": "Search",
        "tool_input": "weather in San Francisco",
        "log": "Now I need to search for the weather"
      },
      "Current weather in San Francisco: 65°F, partly cloudy"
    ],
    [
      {
        "tool": "Wikipedia",
        "tool_input": "Golden Gate Bridge history",
        "log": "Let me find information about the Golden Gate Bridge"
      },
      "The Golden Gate Bridge is a suspension bridge spanning the Golden Gate strait..."
    ]
  ],
  "output": "Based on my research: The calculation is 200, the weather is 65°F and partly cloudy, and I found information about the Golden Gate Bridge."
};

export const SAMPLE_OPENAI_TRACE = {
  "id": "chatcmpl-abc123",
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant with access to tools."
    },
    {
      "role": "user", 
      "content": "What's the weather like and what should I wear?"
    },
    {
      "role": "assistant",
      "content": "Let me check the current weather for you.",
      "tool_calls": [
        {
          "id": "call_001",
          "function": {
            "name": "get_weather",
            "arguments": "{\"location\": \"current\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "content": "Temperature: 72°F, Sunny, Light breeze",
      "tool_call_id": "call_001"
    },
    {
      "role": "assistant",
      "content": "The weather is beautiful! It's 72°F and sunny with a light breeze. I recommend wearing light, comfortable clothing like a t-shirt and shorts or a light dress. You might want to bring sunglasses!"
    }
  ]
};

export const SAMPLE_CUSTOM_TRACE = {
  "session_id": "custom-sess-456",
  "agent_type": "reasoning_agent",
  "steps": [
    {
      "step_id": "s1",
      "category": "thinking",
      "text": "The user wants to understand recursion. Let me plan my explanation.",
      "created_at": "2024-01-15T14:00:00Z"
    },
    {
      "step_id": "s2", 
      "category": "action",
      "text": "fetch_example",
      "data": {"topic": "recursion", "language": "python"},
      "created_at": "2024-01-15T14:00:02Z"
    },
    {
      "step_id": "s3",
      "category": "result",
      "text": "def factorial(n):\\n  if n <= 1:\\n    return 1\\n  return n * factorial(n-1)",
      "created_at": "2024-01-15T14:00:04Z"
    },
    {
      "step_id": "s4",
      "category": "output",
      "text": "Recursion is when a function calls itself. Here's a simple example with factorial:\\n\\ndef factorial(n):\\n  if n <= 1:\\n    return 1\\n  return n * factorial(n-1)\\n\\nThis function calls itself with n-1 until it reaches the base case.",
      "created_at": "2024-01-15T14:00:06Z"
    }
  ]
};

export const SAMPLE_SIMPLE_ARRAY = [
  { "type": "thought", "content": "Starting analysis of the problem" },
  { "type": "action", "content": "Searching database for relevant records" },
  { "type": "observation", "content": "Found 15 matching records" },
  { "type": "thought", "content": "Need to filter by date range" },
  { "type": "action", "content": "Applying date filter 2024-01-01 to 2024-12-31" },
  { "type": "observation", "content": "Filtered to 8 records" },
  { "type": "output", "content": "Analysis complete. Found 8 relevant records matching your criteria." }
];

export const SAMPLE_WITH_ISSUES = {
  "run_id": "debug-trace-001",
  "agent_type": "faulty_agent",
  "steps": [
    {
      "id": "step-1",
      "type": "thought",
      "content": "User wants to search for restaurants. Let me search.",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "id": "step-2",
      "type": "action",
      "tool": "search_restaurants",
      "tool_input": {"query": "italian restaurants nearby"},
      "content": "Calling search_restaurants",
      "timestamp": "2024-01-15T10:00:01Z"
    },
    {
      "id": "step-3",
      "type": "observation",
      "content": "Error: API rate limit exceeded. No results returned.",
      "status": "error",
      "timestamp": "2024-01-15T10:00:02Z"
    },
    {
      "id": "step-4",
      "type": "action",
      "tool": "search_restaurants",
      "tool_input": {"query": "italian restaurants nearby"},
      "content": "Calling search_restaurants again",
      "timestamp": "2024-01-15T10:00:03Z"
    },
    {
      "id": "step-5",
      "type": "action",
      "tool": "search_restaurants",
      "tool_input": {"query": "italian restaurants nearby"},
      "content": "Retrying search_restaurants",
      "timestamp": "2024-01-15T10:00:04Z"
    },
    {
      "id": "step-6",
      "type": "action",
      "tool": "search_restaurants",
      "tool_input": {"query": "italian restaurants nearby"},
      "content": "Retrying search_restaurants again",
      "timestamp": "2024-01-15T10:00:05Z"
    },
    {
      "id": "step-7",
      "type": "observation",
      "content": "No results found",
      "timestamp": "2024-01-15T10:00:06Z"
    },
    {
      "id": "step-8",
      "type": "thought",
      "content": "Found 5 great options for the user!",
      "timestamp": "2024-01-15T10:00:07Z"
    },
    {
      "id": "step-9",
      "type": "output",
      "content": "I found some excellent Italian restaurants for you! Here are my top picks: 1. Bella Italia 2. Pasta Paradise 3. The Roman Kitchen",
      "timestamp": "2024-01-15T10:00:08Z"
    }
  ]
};

export const SAMPLE_LANGGRAPH_FULL = {
  "run_id": "lg-full-trace-001",
  "langgraph_version": "0.2.0",
  "graph_id": "multi_agent_workflow",
  "thread_id": "thread-abc123",
  "events": [
    {
      "id": "node-1",
      "node": "supervisor",
      "type": "ai_message",
      "content": "Received user request. Delegating to research agent.",
      "state": {"messages": [], "next": "research"},
      "config": {"model": "gpt-4"},
      "timestamp": "2024-01-15T12:00:00Z"
    },
    {
      "id": "node-2",
      "node": "research",
      "type": "tool_call",
      "tool": "web_search",
      "tool_input": {"query": "climate change solutions 2024"},
      "content": "Searching for climate solutions",
      "next": ["research"],
      "timestamp": "2024-01-15T12:00:02Z"
    },
    {
      "id": "node-3",
      "node": "research",
      "type": "tool_result",
      "content": "Found 12 articles on renewable energy, carbon capture, and policy changes.",
      "values": {"research_results": ["article1", "article2"]},
      "timestamp": "2024-01-15T12:00:05Z"
    },
    {
      "id": "node-4",
      "node": "analyst",
      "type": "ai_message",
      "content": "Analyzing research results. Key themes: renewable energy adoption, policy frameworks, technology innovation.",
      "state_after": {"analysis_complete": true},
      "timestamp": "2024-01-15T12:00:08Z"
    },
    {
      "id": "node-5",
      "node": "writer",
      "type": "ai_message",
      "content": "Drafting summary based on analysis...",
      "next": "end",
      "timestamp": "2024-01-15T12:00:10Z"
    },
    {
      "id": "node-6",
      "node": "end",
      "type": "final_answer",
      "content": "Climate Change Solutions Summary:\\n\\n1. Renewable Energy: Solar and wind adoption growing 25% YoY\\n2. Carbon Capture: New technologies showing promise\\n3. Policy: Paris Agreement commitments strengthening\\n\\nThe outlook is cautiously optimistic with significant investment needed.",
      "is_final": true,
      "checkpoint": {"id": "ckpt-final-001"},
      "timestamp": "2024-01-15T12:00:15Z"
    }
  ]
};

export const ALL_SAMPLES = {
  'LangGraph': SAMPLE_LANGGRAPH_TRACE,
  'LangGraph (Full)': SAMPLE_LANGGRAPH_FULL,
  'LangChain': SAMPLE_LANGCHAIN_TRACE,
  'OpenAI': SAMPLE_OPENAI_TRACE,
  'Custom Agent': SAMPLE_CUSTOM_TRACE,
  'Simple Array': SAMPLE_SIMPLE_ARRAY,
  'With Issues (Debug)': SAMPLE_WITH_ISSUES,
};
