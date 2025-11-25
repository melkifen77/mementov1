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

export const ALL_SAMPLES = {
  'LangGraph': SAMPLE_LANGGRAPH_TRACE,
  'LangChain': SAMPLE_LANGCHAIN_TRACE,
  'OpenAI': SAMPLE_OPENAI_TRACE,
  'Custom Agent': SAMPLE_CUSTOM_TRACE,
  'Simple Array': SAMPLE_SIMPLE_ARRAY,
};
