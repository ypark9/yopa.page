---
title: (AWS re:invent 2025) Real-Time Voice Agents with AWS Nova Sonic
date: 2025-12-14
author: Yoonsoo Park
description: "How to build ultra-low latency, interruptible voice agents using Amazon Nova Sonic and WebSocket streams."
categories:
  - Voice AI
  - AWS Nova
  - Real-Time Systems
tags:
  - Nova Sonic
  - Speech-to-Speech
  - WebSockets
---

Building a real-time voice agent is hard because of **Latency**. If the user says "Hello," and the bot takes 3 seconds to convert Speech-to-Text (STT), then LLM, then Text-to-Speech (TTS), the conversation feels dead.

**Amazon Nova Sonic** acts as a unified multimodal model that handles audio-in/audio-out in a single stream, cutting latency dramatically.

## Architecture: The WebSocket Stream

Unlike a REST API, Nova Sonic requires a persistent connection.

![Nova Sonic bidirectional stream API](images/nova-sonic-sequential.png)

For example, we can build a simple bot using Nova Sonic.

1.  **Client (React):** Captures microphone audio.
2.  **Server (FastAPI):** Proxies the stream to Bedrock via HTTP/2.
3.  **Model (Nova Sonic):** Consumes audio chunks and streams back audio chunks.

## The Event Sequence (Speculative Decoding)

To make it feel even faster, Nova Sonic sends text *before* the audio is fully ready.

1.  **User Splits:** "What is the weather?"
2.  **Speculative Transcript:** Server sends `generationStage: "SPECULATIVE"` text. The UI shows this immediately.
3.  **Audio Output:** The actual sound bytes arrive.
4.  **Final Transcript:** The official log.

### Handling "Barge-In" (Interruptions)

If the user interrupts the bot ("No, wait—"), Nova Sonic detects this and sends `{"interrupted": true}`.
**Critical Implementation Detail:** Your client MUST immediately clear its audio buffer when this flag is received.

## Defining Tools for Voice

Nova Sonic can call tools just like a text agent.

```json
"toolConfiguration": {
  "tools": [
    {
      "toolSpec": {
        "name": "get_weather",
        "description": "Get weather for a location",
        "inputSchema": {
          "json": {
            "type": "object",
            "properties": {
              "city": { "type": "string" }
            },
            "required": ["city"]
          }
        }
      }
    }
  ]
}
```

## RAG Integration (Knowledge Base)

You can wrap a Bedrock Knowledge Base query inside a Python function tool.

```python
def retrieve_kb(query):
    # Call Bedrock Agent Runtime
    response = bedrock_runtime.retrieve(
        knowledgeBaseId=KB_ID,
        retrievalQuery={'text': query},
        retrievalConfiguration={
            'vectorSearchConfiguration': {'numberOfResults': 1}
        }
    )
    return response['retrievalResults'][0]['content']['text']
```

## Strands Integration: The "Brain" Pattern

![Strands Integration](images/nova_sonic_strands_integration.png)

For complex reasoning (e.g., "Plan a travel itinerary and check budget"), Nova Sonic might struggle. The pattern is to use **Nova Sonic as the Router** and **Strands as the Brain**.

1.  Nova Sonic hears the complex request.
2.  It calls a "Meta-Tool" named `externalAgent`.
3.  The Strands Agent (running Claude 3.5 Sonnet) performs the logic.
4.  The text result is returned to Nova Sonic to speak.

**Conclusion:** Use Nova Sonic for speed (simple Q&A). Offload to Strands for deep reasoning.

references:
*   [Nova Sonic Documentation](https://docs.aws.amazon.com/nova/latest/userguide/speech.html#speech-architecture)