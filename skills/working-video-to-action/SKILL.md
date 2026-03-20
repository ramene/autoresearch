---
name: video-to-action
description: Extract actionable steps from YouTube videos using Gemini video understanding. Use when user provides a YouTube link and wants to learn procedures, extract steps, understand visual tutorials, or turn video content into executable instructions.
allowed-tools: Read, Grep, Glob, Bash
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Video-to-Action — Learn from YouTube via Gemini

## Goal
Take a YouTube URL → send the video to Gemini → get back structured, actionable steps that Claude can understand and execute. Works for tutorials, demos, how-tos, and any procedural video content.

## Claude Execution Steps

When this skill is invoked, Claude must follow these steps in order:

1. **Identify the YouTube URL** from the user's message
2. **Check environment** — verify `NANO_BANANA_API_KEY` is set in `.env` (run `grep NANO_BANANA_API_KEY .env 2>/dev/null || echo "MISSING"`)
3. **Check dependencies** — verify `yt-dlp` and `python3` are available (`which yt-dlp && python3 -c "import google.generativeai" 2>&1`)
4. **Construct and run the command** — use the Bash tool with this decision table:

   | User requested quick? | User asked a question? | Command to run |
   |----------------------|----------------------|----------------|
   | No | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>"` |
   | No | Yes | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" -q "<question>"` |
   | Yes | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick` |
   | Yes | Yes | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick -q "<question>"` |

   **Quick mode triggers**: user says "quick", "fast", or "transcript", OR video is clearly a talk/lecture/podcast with no visual interaction. Default to full mode otherwise.

   **Additional flags** — append any of these to the base command above as needed:
   - User wants output saved to a file → add `-o <filepath>` (e.g. `-o steps.md`)
   - User wants JSON output → add `--json`
   - User requests maximum detail or a specific model → add `-m gemini-2.5-pro` (or the model they named)
   - These flags are independent and can be combined: e.g. `python3 ... "<URL>" --quick -q "..." --json -o results.json`

5. **Parse the output** — read the structured steps returned by Gemini
6. **Present results** — show the extracted steps to the user with context
7. **Offer next actions** — ask if user wants to execute steps, save as checklist, or build automation

### Error Handling
- If `NANO_BANANA_API_KEY` is missing: tell the user to add it to `.env` and stop
- If `yt-dlp` is missing: tell the user to run `pip install yt-dlp` and stop
- If video download fails (private/age-restricted): suggest `--quick` mode if captions exist, or inform user the video is inaccessible
- If script exits with error: show the error output and suggest trying `--quick` mode as fallback
- If `--quick` fails (no captions available): automatically retry with full mode (no `--quick` flag) — do not ask the user, just switch and inform them
- If both full mode and `--quick` fail: report both error outputs and ask the user for a different video

## How It Works

1. **Full mode** (default): Downloads video at low res → uploads to Gemini File API → Gemini watches the video and returns structured analysis
2. **Quick mode** (`--quick`): Extracts transcript only → sends to Gemini → faster and cheaper but no visual context
3. **Fallback chain**: If video upload fails → extracts frames every 30s + transcript → sends as images + text

## Usage

```bash
# Default: full video analysis (visual + audio)
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID"

# Ask a specific question about the video
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" -q "What keyboard shortcuts are demonstrated?"

# Quick mode: transcript only (faster, cheaper)
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" --quick

# Quick mode with a specific question
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" --quick -q "What are the main takeaways?"

# Save to file
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" -o active/steps.md

# JSON output
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" --json

# Use Gemini Pro for maximum detail (slower, more expensive)
python3 .claude/skills/video-to-action/video_to_action.py "https://youtube.com/watch?v=VIDEO_ID" -m gemini-2.5-pro
```

## When to Use Which Mode

| Mode | Flag | Speed | Cost | Best For |
|------|------|-------|------|----------|
| Full | (default) | ~1-3 min | ~$0.05-0.20 | Visual tutorials (Blender, Figma, code editors), demos with UI |
| Quick | `--quick` | ~15-30s | ~$0.01-0.03 | Talks, lectures, podcasts, text-heavy content |

**Decision rule**: Use full mode by default. Only use `--quick` if the user says "quick", "fast", or "transcript", or if the video is clearly a talk/lecture/podcast (no visual interaction expected).

## Workflow: Video → Action

After extracting steps, Claude can:
1. **Execute steps directly** — if the steps involve CLI commands, code, or file operations
2. **Create a checklist** — save steps to a file for the user to follow
3. **Build automation** — turn procedural steps into a script or n8n workflow
4. **Create course content** — use as research input for outline-generator skill

### Example: Learning a Blender Tutorial
```
User: Learn how to model a donut from this video: https://youtube.com/watch?v=...
```
1. Run video_to_action.py to extract steps
2. Claude receives structured steps with timestamps, menu paths, keyboard shortcuts
3. Claude can then guide the user through each step, or even drive Blender via scripting

## Environment
Requires in `.env`:
```
NANO_BANANA_API_KEY=your_gemini_api_key
```

## Dependencies
- `yt-dlp` — video/transcript download
- `ffmpeg` — frame extraction (fallback mode)
- `google-genai` — Gemini API
- `Pillow` — image handling (fallback mode)
- `python-dotenv`

## Limitations
- Gemini File API: videos up to ~2GB / ~1 hour for full analysis
- Longer videos: use `--quick` mode or ask about specific timestamps
- Some videos have no auto-captions — `--quick` mode will fail, use full mode
- Private/age-restricted videos may not download