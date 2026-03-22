/**
 * Shared email theme — Tailwind-style utility classes for HTML emails.
 * Light theme, mobile-first responsive.
 *
 * Used by:
 *   - send-report.mjs        (autoresearch loop report — cron fires every 8 hours)
 *   - send-session-report.mjs (session provisioning report — fires on /scaffold)
 *
 * Both reports import: `import { EMAIL_STYLE } from './email-theme.mjs'`
 * Then use: `<style>${EMAIL_STYLE}</style>` in the <head>.
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW TO MODIFY THIS TEMPLATE
 * ═══════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 *   email-theme.mjs    — shared <style> block (this file). ONE place to change colors/spacing.
 *   send-report.mjs    — loop report HTML. Uses .header-loop class.
 *   send-session-report.mjs — session report HTML. Uses .header-session class.
 *   Both import EMAIL_STYLE and inject it into <style> tags.
 *
 * ── COLORS ──────────────────────────────────────────────────────────
 *
 *   Search "Color Palette" below. All colors in one comment block.
 *
 *   Body background:    #f1f5f9  (slate-100)     — `body` + `<body style="...">`
 *   Card background:    #ffffff  (white)          — `.card`
 *   Card border:        #e2e8f0  (slate-200)      — `.card`
 *   Section borders:    #e2e8f0  (slate-200)      — `.border-b`
 *   Primary text:       #0f172a  (slate-900)      — `.text-slate-900`, `.card color`
 *   Secondary text:     #334155  (slate-700)      — `.text-slate-700`, `.info-val`
 *   Muted text:         #64748b  (slate-500)      — `.text-slate-500`, `.config-item`
 *   Label text:         #94a3b8  (slate-400)      — `.section-label`, `.stat-label`
 *   Surface (pills):    #f1f5f9  (slate-100)      — `.pill`, `.skill-tag`, `.code-val`
 *
 *   IMPORTANT: Also update the inline `style="background-color:..."` on <body>
 *   in BOTH report files when changing body bg. Gmail strips <style> body rules
 *   but keeps inline styles.
 *
 * ── HEADER GRADIENTS ────────────────────────────────────────────────
 *
 *   .header-session  — slate:        #334155 → #475569
 *   .header-loop     — teal/emerald: #065f46 → #0d9488 → #14b8a6
 *
 *   To add a 3rd report type (e.g. monthly):
 *     1. Add `.header-monthly { background: linear-gradient(...); }` here
 *     2. Use `<div class="header-monthly p-5 sm-px-7 border-b-2">` in the report
 *
 * ── SPACING (MOBILE-FIRST) ──────────────────────────────────────────
 *
 *   Base (mobile, < 640px):
 *     .p-3    = 12px all sides    (outer wrapper)
 *     .p-5    = 20px all sides    (header)
 *     .px-4   = 16px left+right   (sections)
 *     .py-3   = 12px top+bottom   (sections)
 *
 *   sm: (>= 640px, desktop):
 *     .sm-p-6  = 24px   (outer wrapper)
 *     .sm-px-7 = 28px   (sections left+right)
 *
 *   To change mobile padding: edit .px-4 and .py-3
 *   To change desktop padding: edit @media block at bottom
 *
 * ── STATS ROW ───────────────────────────────────────────────────────
 *
 *   Mobile:  .stat-item { flex: 1 1 100% }  → stacks vertically
 *   Desktop: .stat-item { flex: 1 1 0 }     → side-by-side row
 *   Dividers swap from border-bottom (mobile) to border-right (desktop)
 *
 * ── PILLS / CHIPS ───────────────────────────────────────────────────
 *
 *   Uses inline-block + margin-right + margin-bottom.
 *   DO NOT use flexbox `gap` — Gmail Android strips it.
 *
 *   .pill      — MCP servers, round counts (colored bg variants via inline style)
 *   .skill-tag — skill names (monospace, smaller)
 *   .code-val  — file paths, inline code
 *
 * ── ADDING A NEW SECTION ────────────────────────────────────────────
 *
 *   In the report .mjs file, add inside the <div class="card">:
 *
 *   <div class="px-4 py-3 sm-px-7 border-b">
 *     <div class="section-label">Section Name</div>
 *     <!-- your content here -->
 *   </div>
 *
 * ── ADDING A NEW REPORT TYPE ────────────────────────────────────────
 *
 *   1. Copy send-session-report.mjs as your starting point
 *   2. Add a new .header-xxx class in this file with a unique gradient
 *   3. Change the data extraction logic to match your source
 *   4. Keep the same HTML structure: header → stats → sections → footer
 *   5. Import { EMAIL_STYLE } from './email-theme.mjs'
 *
 * ── TESTING ─────────────────────────────────────────────────────────
 *
 *   Send a test email:
 *     node send-session-report.mjs "test-session" "/path/to/workspace" "/path/to/PLAN.md"
 *     node send-report.mjs "/path/to/loop-log.log"
 *
 *   Check on both mobile Gmail app AND desktop Gmail web.
 *   The `<meta name="color-scheme" content="light">` prevents dark mode inversion.
 *
 * ── EMAIL CLIENT COMPATIBILITY ──────────────────────────────────────
 *
 *   Gmail (web + app):  Supports <style> blocks, @media queries, flexbox.
 *                        Strips: gap property, external CSS, JS.
 *   Apple Mail:          Full CSS support.
 *   Outlook (web):       Supports most, strips some flexbox.
 *   Outlook (desktop):   Uses Word renderer. Flexbox breaks. Consider
 *                        table fallback if Outlook desktop is needed.
 *
 *   Current target: Gmail only (web + iOS + Android).
 */

export const EMAIL_STYLE = `
  /* ── Reset ── */
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Color Palette ── */
  /* --bg: #f8fafc  --border: #e2e8f0  --text: #0f172a  --muted: #64748b  --surface: #f1f5f9 */

  /* ── Mobile-first base (< 640px) ── */
  body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
  .p-3 { padding: 12px; }
  .p-5 { padding: 20px; }
  .px-4 { padding-left: 16px; padding-right: 16px; }
  .py-3 { padding-top: 12px; padding-bottom: 12px; }
  .mt-2 { margin-top: 8px; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }

  .text-xs { font-size: 12px; }
  .text-sm { font-size: 14px; }
  .text-lg { font-size: 18px; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .uppercase { text-transform: uppercase; }
  .tracking-wider { letter-spacing: 0.1em; }
  .break-all { word-break: break-all; }
  .text-center { text-align: center; }

  .text-slate-900 { color: #0f172a; }
  .text-slate-700 { color: #334155; }
  .text-slate-500 { color: #64748b; }
  .text-slate-400 { color: #94a3b8; }
  .text-white { color: #ffffff; }

  .border-b { border-bottom: 1px solid #e2e8f0; }
  .border-b-2 { border-bottom: 2px solid #cbd5e1; }
  .rounded-full { border-radius: 9999px; }
  .inline-block { display: inline-block; }
  .flex { display: flex; }
  .flex-wrap { flex-wrap: wrap; }
  .font-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }

  /* ── Card ── */
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; color: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }

  /* ── Headers (different gradient per report type) ── */
  .header-session { background: linear-gradient(135deg, #334155, #475569); }
  .header-loop { background: linear-gradient(135deg, #065f46, #0d9488, #14b8a6); }

  /* ── Section label ── */
  .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 8px; font-weight: 600; }

  /* ── Stats row (stacks on mobile, row on sm:) ── */
  .stat-item { flex: 1 1 100%; text-align: center; padding: 14px 8px; border-bottom: 1px solid #e2e8f0; }
  .stat-num { font-size: 24px; font-weight: 700; }
  .stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

  /* ── Pills & tags (inline-block + margin for email compat) ── */
  .pill { background: #f1f5f9; color: #7c3aed; padding: 5px 12px; border-radius: 6px; font-size: 12px; border: 1px solid #e2e8f0; display: inline-block; margin: 0 6px 8px 0; }
  .skill-tag { background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; display: inline-block; margin: 0 6px 6px 0; color: #334155; border: 1px solid #e2e8f0; }
  .code-val { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; word-break: break-all; color: #334155; }

  /* ── Info table ── */
  .info-table { width: 100%; font-size: 12px; border-collapse: collapse; }
  .info-table td { padding: 4px 0; vertical-align: top; }
  .info-key { color: #94a3b8; width: 70px; white-space: nowrap; padding-right: 8px; }
  .info-val { color: #334155; word-break: break-all; font-size: 11px; }

  /* ── Fleet stats ── */
  .fleet-item { flex: 1 1 33.33%; min-width: 80px; text-align: center; padding: 10px 0; }
  .fleet-num { font-size: 22px; font-weight: 700; }
  .fleet-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .fleet-meta { display: inline-block; margin-right: 12px; margin-bottom: 4px; font-size: 12px; color: #94a3b8; white-space: nowrap; }

  /* ── Config dots ── */
  .config-item { display: inline-block; margin-right: 14px; margin-bottom: 6px; font-size: 12px; color: #64748b; white-space: nowrap; }

  /* ── sm: (>= 640px) — side-by-side stats, roomier padding ── */
  @media (min-width: 640px) {
    .sm-p-6 { padding: 24px; }
    .sm-px-7 { padding-left: 28px; padding-right: 28px; }
    .sm-text-xl { font-size: 20px; }
    .stat-item { flex: 1 1 0; border-bottom: none; border-right: 1px solid #e2e8f0; }
    .stat-item:last-child { border-right: none; }
    .stat-num { font-size: 28px; }
    .pill { font-size: 11px; padding: 4px 10px; }
  }
`
