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

1. **Identify the YouTube URL** from the user's message. Accept any of these URL formats as-is — do not reformat or expand them:
   - Standard: `https://www.youtube.com/watch?v=VIDEO_ID`
   - Shortened: `https://youtu.be/VIDEO_ID`
   - Shorts: `https://www.youtube.com/shorts/VIDEO_ID`
   - With timestamp: any of the above with `&t=123s` or `?t=123`

2. **Check environment** — verify `NANO_BANANA_API_KEY` is available. Run both checks and consider it found if either succeeds:
   - Check `.env` file: `grep NANO_BANANA_API_KEY .env 2>/dev/null | head -1`
   - Check shell environment: `echo "${NANO_BANANA_API_KEY:-MISSING}"`
   - If both return empty/MISSING: tell the user to add it to `.env` and stop
   - If either returns a non-empty value that isn't "MISSING": proceed to step 3
3. **Check dependencies** — verify `yt-dlp` and `python3` are available (`which yt-dlp && python3 -c "import google.generativeai" 2>&1`)
4. **Construct and run the command** — use the Bash tool. Find the row in the decision table below that matches the user's request and construct the command exactly as shown, replacing placeholders like `<URL>` and `<question>`.

| User wants "quick"? | User asked a question? | User wants to save to a file? | Command to run |
| :--- | :--- | :--- | :--- |
| No | No | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>"` |
| No | No | Yes (e.g., `steps.md`) | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" -o steps.md` |
| No | Yes | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" -q "<question>"` |
| No | Yes | Yes (e.g., `results.md`) | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" -q "<question>" -o results.md` |
| Yes | No | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick` |
| Yes | No | Yes (e.g., `transcript.txt`) | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick -o transcript.txt` |
| Yes | Yes | No | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick -q "<question>"` |
| Yes | Yes | Yes (e.g., `answer.txt`) | `python3 .claude/skills/video-to-action/video_to_action.py "<URL>" --quick -q "<question>" -o answer.txt` |

   **Important Notes for Command Construction:**
   - **Quick Mode Triggers**: Use a "Yes" row for "quick" if the user says "quick", "fast", or "transcript", OR if the video is clearly a talk/lecture with no visual interaction. Default to "No" otherwise.
   - **Other Flags**: If the user requests JSON output, add `--json`. If they request a specific model, add `-m <model_name>`. These can be appended to any command from the table. For example: `... -q "<question>" -o results.json --json`.

5. **Parse the output** — read the script's stdout. The output is structured text (or JSON if `--json` was used). Extract:
   - The numbered/bulleted steps or sections Gemini returned
   - Any timestamps, tool names, keyboard shortcuts, or menu paths mentioned
   - Any warnings or notes Gemini included about the video content

6. **Present results** — choose the format based on whether a question (`-q`) was used. Always present a single, unified response — do not output a separate notification before Step 6; the "Mode used" field below is where any mode-switch information belongs.

   **When a specific question was asked (`-q` flag used):**
   - **One-sentence summary** of what the video covers
   - **Mode used**: state which mode was actually used (e.g., "Full video analysis", "Quick/transcript mode"). If an auto-retry mode switch occurred (see Error Handling), state it here: e.g., "Quick mode (auto-switched from full — video upload failed)"
   - **Direct answer**: present Gemini's answer to the question clearly, preserving any technical details, timestamps, or menu paths exactly as returned
   - **Supporting context**: 1-2 bullet points with relevant background from the video that supports the answer

   **When no question was asked (step-extraction mode):**
   - **One-sentence summary** of what the video covers
   - **Mode used**: state which mode was actually used (e.g., "Full video analysis", "Quick/transcript mode"). If an auto-retry mode switch occurred (see Error Handling), state it here: e.g., "Quick mode (auto-switched from full — video upload failed)"
   - **Extracted steps**: display each step clearly numbered, preserving timestamps and technical details (keyboard shortcuts, menu paths, commands) exactly as Gemini returned them
   - **Key takeaways**: 2-3 bullet points highlighting the most important techniques or concepts

7. **Offer next actions** — after presenting results, explicitly ask the user which of these they want:
   - **"Execute steps"** — Claude will run any CLI commands or code steps directly
   - **"Save as checklist"** — Claude will write the steps to a markdown file (ask for filename if not provided)
   - **"Build automation"** — Claude will turn the steps into a script or workflow
   - **"Ask a follow-up question"** — Claude will re-run the script with `-q` to dig deeper into a specific part
   - State these options explicitly so the user can choose by number or keyword

### Error Handling

Use this decision tree exactly — each retry happens **at most once**. When a retry succeeds, proceed directly to Step 6 (do not output a separate mid-flow notification; report the mode switch in the "Mode used" field of Step 6 instead):

1. **`NANO_BANANA_API_KEY` missing** from both `.env` and shell environment → tell the user to add it to `.env` and **stop**
2. **`yt-dlp` missing** → tell the user to run `pip install yt-dlp` and **stop**
3. **Video download fails** (private/age-restricted) → suggest `--quick` mode if captions may exist, or inform user the video is inaccessible and **stop**
4. **Full mode fails for any reason** (video too large, upload error, API error, timeout, etc.):
   - **Automatically retry once with `--quick` mode** (append `--quick` to the same command, keeping all other flags) — do not ask the user first, do not output a notification yet
   - If `--quick` succeeds: proceed to Step 6; in the "Mode used" field write: "Quick mode (auto-switched from full — [brief reason])"
   - If `--quick` also fails → go to step 6 (both failed)
5. **Quick mode fails for any reason** (no captions, API error, timeout, parse error, etc.) when quick was the **original** user request:
   - **Automatically retry once with full mode** (remove the `--quick` flag, keeping all other flags) — do not ask the user first, do not output a notification yet
   - If full mode succeeds: proceed to Step 6; in the "Mode used" field write: "Full video analysis (auto-switched from quick — [brief reason])"
   - If full mode also fails → go to step 6 (both failed)
6. **Both modes have been attempted and both failed** → report both error outputs to the user and ask them for a different video. **Do not retry again.**

> **Important**: Each direction of retry happens at most once per invocation. If full fails → try quick (once). If quick then also fails, stop. Never retry the same mode twice or loop back.

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
Requires `NANO_BANANA_API_KEY` set either in `.env` file or as a shell environment variable:
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