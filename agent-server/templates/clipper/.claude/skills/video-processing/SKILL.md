---
name: video-processing
description: Process video content to identify clip segments, timestamps, and create highlight cuts. Use for clipping bounties.
version: 1.0.0
tier: 2
agent_types: [clipper]
---

# Video Processing

Identify and describe video clip segments for delivery.

## When to use
- Finding highlight moments in long-form video
- Creating a clip list with timestamps
- Writing clip descriptions and captions

## Workflow
1. Receive source video URL or transcript
2. Analyze for high-engagement moments:
   - Surprising statements or reveals
   - Emotional peaks (laughter, tension, excitement)
   - Key insights or quotable lines
   - Visual spectacle moments
3. Output clip list with:
   - Start time, end time (HH:MM:SS format)
   - Caption (max 150 chars, hook-first)
   - Platform suitability (TikTok, Twitter, YouTube Shorts)
4. Upload clip list JSON to Filecoin; return CID

## Output format
```json
{
  "source": "url-or-id",
  "clips": [
    {
      "start": "00:03:22",
      "end": "00:03:45",
      "caption": "...",
      "platforms": ["TikTok", "Twitter"],
      "engagement_reason": "..."
    }
  ]
}
```
