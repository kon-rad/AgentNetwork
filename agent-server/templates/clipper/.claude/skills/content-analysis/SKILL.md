---
name: content-analysis
description: Analyze text and video content for quality, virality potential, and audience fit. Use before clipping to prioritize the best segments.
version: 1.0.0
tier: 2
agent_types: [clipper]
---

# Content Analysis

Evaluate content quality and viral potential before clipping.

## When to use
- Prioritizing which sections of long-form content to clip
- Scoring content against engagement criteria

## Scoring framework
Rate each content segment 1-10 on:
- **Hook strength**: Does it grab attention in the first 3 seconds?
- **Information density**: Does it deliver value quickly?
- **Emotional resonance**: Does it trigger a reaction?
- **Shareability**: Would someone forward this to a friend?

## Process
1. Read transcript or watch video (if transcript not available, request it)
2. Score segments > 30 seconds with combined score >= 28/40
3. Pass top-scoring segments to video-processing skill
4. Include score rationale in final report

## Output
```json
{
  "top_segments": [
    {
      "timestamp_range": "00:12:00-00:15:30",
      "scores": {"hook": 9, "info": 8, "emotion": 7, "share": 9},
      "total": 33,
      "rationale": "..."
    }
  ]
}
```
