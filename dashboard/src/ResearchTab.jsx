import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight,
  FileText, Upload, Trash2, Eye, ArrowRight, Loader2, ChevronDown,
  Search, Filter, RefreshCw, User, BookOpen, Tag, Star
} from 'lucide-react'

const POLL_INTERVAL = 3000

const STAGE_NAMES = ['Claude Synthesis', 'Gemini Reasoning', 'Claude Execution']

const STATUS_BADGE = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock },
  running: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Loader2 },
  complete: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  error: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
}

const VERDICT_COLORS = {
  confirmed: { bg: 'bg-green-100', text: 'text-green-700' },
  challenged: { bg: 'bg-amber-100', text: 'text-amber-700' },
  enhanced: { bg: 'bg-blue-100', text: 'text-blue-700' },
  contradicted: { bg: 'bg-red-100', text: 'text-red-700' },
  new: { bg: 'bg-purple-100', text: 'text-purple-700' },
}

const DOMAIN_CATEGORIES = [
  { id: 'olfactory', label: 'Olfactory Perception', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'spatial', label: 'Spatial Architecture', color: 'bg-sky-100 text-sky-700' },
  { id: 'phenomenology', label: 'Phenomenology', color: 'bg-violet-100 text-violet-700' },
  { id: 'memory', label: 'Episodic Memory', color: 'bg-rose-100 text-rose-700' },
  { id: 'crossmodal', label: 'Cross-modal Design', color: 'bg-orange-100 text-orange-700' },
  { id: 'neuroscience', label: 'Neuroscience', color: 'bg-cyan-100 text-cyan-700' },
]

// ─── Inline markdown for short snippets ──────────────────────────────────────

function renderInlineMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-0.5 rounded text-[10px]">$1</code>')
}

// ─── Extract researchers from pipeline output ────────────────────────────────

function getCustomResearchers() {
  try { return JSON.parse(localStorage.getItem('custom-researchers') || '[]') } catch { return [] }
}

function saveCustomResearchers(list) {
  localStorage.setItem('custom-researchers', JSON.stringify(list))
}

function extractResearchers(outputs, customResearchers = []) {
  if (!outputs) return []
  const text = Object.values(outputs).join('\n')
  const known = [
    { name: 'Gernot Bohme', domain: 'Philosopher/aesthetician', key: 'Atmospheres theory', tier: 1 },
    { name: 'Edmund Husserl', domain: 'Phenomenologist', key: 'Intentionality, Lebenswelt', tier: 1 },
    { name: 'Endel Tulving', domain: 'Cognitive neuroscientist', key: 'Episodic memory theory', tier: 1 },
    { name: 'Ann-Sophie Barwich', domain: 'Philosopher of neuroscience', key: 'Smellosophy (2020)', tier: 1 },
    { name: 'Eric Kandel', domain: 'Neuroscientist (Nobel)', key: 'Synaptic plasticity', tier: 1 },
    { name: 'Vilaplana', domain: 'Multisensory design', key: 'Cross-modal sensory design', tier: 1 },
    { name: 'Yamanaka', domain: 'Multisensory design', key: 'Cross-modal sensory design', tier: 1 },
    { name: 'Jimenez-Fajardo', domain: 'Architectural phenomenology', key: 'Anchor paper author', tier: 2 },
    { name: 'Salazar Gonzalez', domain: 'Architecture/spatial experience', key: 'Anchor paper author', tier: 2 },
    { name: 'Juhani Pallasmaa', domain: 'Architecture theory', key: 'The Eyes of the Skin', tier: 3 },
    { name: 'Merleau-Ponty', domain: 'Phenomenology', key: 'Embodied perception', tier: 3 },
    { name: 'Francisco Varela', domain: 'Neurophenomenology', key: 'Enactive cognition', tier: 3 },
    { name: 'Alain Berthoz', domain: 'Spatial cognition', key: 'Spatial navigation', tier: 3 },
  ]
  // Merge custom researchers (always shown, not filtered by text mention)
  const customWithMentions = customResearchers.map(r => {
    const regex = new RegExp(r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const mentions = (text.match(regex) || []).length
    return { ...r, mentions, isCustom: true }
  })
  const knownFiltered = known
    .filter(r => text.includes(r.name))
    .map(r => {
      const regex = new RegExp(r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const mentions = (text.match(regex) || []).length
      return { ...r, mentions }
    })
  return [...knownFiltered, ...customWithMentions]
    .sort((a, b) => a.tier - b.tier || b.mentions - a.mentions)
}

// ─── Extract findings/verdicts from Stage 2 ──────────────────────────────────

function extractFindings(outputs) {
  if (!outputs) return []
  const stage2 = outputs['stage-2-gemini-reasoning.md'] || ''
  const stage3 = outputs['stage-3-agent-team-execution.md'] || ''
  const text = stage2 + '\n' + stage3
  const findings = []
  const verdictPatterns = [
    { regex: /\*\*CONFIRMED\*\*[:\s—–-]*(.+?)(?=\n\n|\n\*\*|$)/gis, verdict: 'confirmed' },
    { regex: /\*\*CHALLENGED\*\*[:\s—–-]*(.+?)(?=\n\n|\n\*\*|$)/gis, verdict: 'challenged' },
    { regex: /\*\*ENHANCED\*\*[:\s—–-]*(.+?)(?=\n\n|\n\*\*|$)/gis, verdict: 'enhanced' },
    { regex: /\*\*CONTRADICTED\*\*[:\s—–-]*(.+?)(?=\n\n|\n\*\*|$)/gis, verdict: 'contradicted' },
  ]
  for (const { regex, verdict } of verdictPatterns) {
    let match
    while ((match = regex.exec(text)) !== null) {
      const snippet = match[1].trim().slice(0, 200)
      if (snippet.length > 20) {
        // Categorize by domain keywords
        const categories = []
        if (/olfact|smell|odor|aroma/i.test(snippet)) categories.push('olfactory')
        if (/architect|spatial|space|build/i.test(snippet)) categories.push('spatial')
        if (/phenomenol|sensorium|lebenswelt|embodied/i.test(snippet)) categories.push('phenomenology')
        if (/memory|episod|hippocam|proust/i.test(snippet)) categories.push('memory')
        if (/cross.?modal|multisensory|synesthes/i.test(snippet)) categories.push('crossmodal')
        if (/neuro|brain|cortex|synap|receptor/i.test(snippet)) categories.push('neuroscience')
        if (categories.length === 0) categories.push('neuroscience')
        findings.push({ verdict, text: snippet, categories, id: findings.length })
      }
    }
  }
  return findings
}

// ─── Pipeline Stepper ──────────────────────────────────────────────────────

const PipelineStepper = ({ stages }) => (
  <div className="flex items-center justify-between px-4">
    {stages.map((s, i) => {
      const badge = STATUS_BADGE[s.status] || STATUS_BADGE.pending
      const Icon = s.status === 'running' ? Loader2 : badge.icon
      return (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badge.bg}`}>
              <Icon className={`w-5 h-5 ${badge.text} ${s.status === 'running' ? 'animate-spin' : ''}`} />
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1.5">{STAGE_NAMES[i]}</span>
            {s.tokens && (
              <span className="text-[10px] text-gray-400 mt-0.5">
                {((s.tokens.input + s.tokens.output) / 1000).toFixed(1)}K tok
              </span>
            )}
            {s.duration && (
              <span className="text-[10px] text-gray-400">
                {(s.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {i < 2 && (
            <ArrowRight className={`w-4 h-4 mx-2 flex-shrink-0 ${
              s.status === 'complete' ? 'text-green-400' : 'text-gray-300'
            }`} />
          )}
        </div>
      )
    })}
  </div>
)

// ─── Researcher Profile Cards ────────────────────────────────────────────────

const ResearcherCards = ({ researchers, onAddCustom, onDeleteCustom }) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDomain, setFormDomain] = useState('')
  const [formKey, setFormKey] = useState('')
  const [formTier, setFormTier] = useState(3)

  const tierLabel = { 1: 'Core Authority', 2: 'Anchor Author', 3: 'Extended Network' }
  const tierColor = {
    1: 'border-amber-300 bg-amber-50',
    2: 'border-blue-300 bg-blue-50',
    3: 'border-gray-200 bg-gray-50',
  }

  const handleAdd = () => {
    if (!formName.trim()) return
    onAddCustom({
      name: formName.trim(),
      domain: formDomain.trim() || 'Unspecified',
      key: formKey.trim() || 'Custom addition',
      tier: Number(formTier),
    })
    setFormName(''); setFormDomain(''); setFormKey(''); setFormTier(3)
    setShowAddForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Researchers ({researchers.length})
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        >
          + Add Researcher
        </button>
      </div>
      {showAddForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Name (required)"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={formDomain}
              onChange={e => setFormDomain(e.target.value)}
              placeholder="Domain (e.g. Philosopher/aesthetician)"
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
            <input
              type="text"
              value={formKey}
              onChange={e => setFormKey(e.target.value)}
              placeholder="Key contribution"
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={formTier}
              onChange={e => setFormTier(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            >
              <option value={1}>Tier 1 - Core Authority</option>
              <option value={2}>Tier 2 - Anchor Author</option>
              <option value={3}>Tier 3 - Extended Network</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!formName.trim()}
              className="px-3 py-1 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >Add</button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs font-medium rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
            >Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {researchers.map((r, i) => (
          <div key={i} className={`rounded-lg border p-2.5 ${tierColor[r.tier] || tierColor[3]}`}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-gray-800">{r.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">{r.mentions}x</span>
                {r.isCustom && (
                  <button
                    onClick={() => onDeleteCustom(r.name)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove custom researcher"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-500 block">{r.domain}</span>
            <span className="text-[10px] text-gray-400 block mt-0.5 italic">{r.key}</span>
            <div className="flex items-center gap-1 mt-1">
              <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium rounded ${
                r.tier === 1 ? 'bg-amber-200 text-amber-800' : r.tier === 2 ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
              }`}>
                {tierLabel[r.tier]}
              </span>
              {r.isCustom && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-purple-100 text-purple-700">custom</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Findings Panel ──────────────────────────────────────────────────────────

const FindingsPanel = ({ findings }) => {
  const [filterVerdict, setFilterVerdict] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  if (!findings || findings.length === 0) return null

  const filtered = findings.filter(f => {
    if (filterVerdict !== 'all' && f.verdict !== filterVerdict) return false
    if (filterCategory !== 'all' && !f.categories.includes(filterCategory)) return false
    return true
  })

  const verdictCounts = {}
  for (const f of findings) verdictCounts[f.verdict] = (verdictCounts[f.verdict] || 0) + 1

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" /> Findings ({findings.length})
      </h4>
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setFilterVerdict('all')}
          className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
            filterVerdict === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >All ({findings.length})</button>
        {Object.entries(verdictCounts).map(([v, count]) => (
          <button
            key={v}
            onClick={() => setFilterVerdict(filterVerdict === v ? 'all' : v)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
              filterVerdict === v ? `${VERDICT_COLORS[v]?.bg} ${VERDICT_COLORS[v]?.text}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >{v} ({count})</button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {DOMAIN_CATEGORIES.map(cat => {
          const count = findings.filter(f => f.categories.includes(cat.id)).length
          if (count === 0) return null
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(filterCategory === cat.id ? 'all' : cat.id)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                filterCategory === cat.id ? cat.color : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{cat.label} ({count})</button>
          )
        })}
      </div>
      {/* Finding cards */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {filtered.map(f => {
          const vc = VERDICT_COLORS[f.verdict] || VERDICT_COLORS.new
          return (
            <div key={f.id} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-gray-100">
              <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded ${vc.bg} ${vc.text}`}>
                {f.verdict}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(f.text) }} />
                <div className="flex gap-1 mt-1">
                  {f.categories.map(c => {
                    const cat = DOMAIN_CATEGORIES.find(d => d.id === c)
                    return cat ? (
                      <span key={c} className={`px-1 py-0.5 text-[9px] rounded ${cat.color}`}>{cat.label}</span>
                    ) : null
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Lightweight Markdown Renderer ───────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return ''
  let html = text
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (lang === 'markdown' || lang === 'md') {
      // Render markdown templates as styled callouts, not grey code blocks
      const inner = code.trim()
        .replace(/^###\s+(.+)$/gm, '<div class="text-xs font-bold text-gray-700 mt-2">$1</div>')
        .replace(/^##\s+(.+)$/gm, '<div class="text-sm font-bold text-gray-800 mt-3">$1</div>')
        .replace(/^#\s+(.+)$/gm, '<div class="text-base font-bold text-gray-900 mt-3">$1</div>')
        .replace(/^[-*]\s+(.+)$/gm, '<div class="ml-3 text-xs text-gray-600">- $1</div>')
      return `<div class="my-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs">`
        + `<div class="text-[10px] font-medium text-amber-600 uppercase tracking-wide mb-1">Template</div>`
        + inner + `</div>`
    }
    return `<pre class="bg-gray-100 rounded p-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-xs font-bold mt-3 mb-1">$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-xs font-bold mt-3 mb-1">$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-sm font-bold mt-4 mb-1">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-base font-bold mt-4 mb-2">$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-lg font-bold mt-4 mb-2">$1</h1>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-3 border-gray-300" />')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">$1</a>')

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-2 border-gray-300 pl-3 italic text-gray-600 my-1">$1</blockquote>')

  // Unordered lists (- item or * item)
  html = html.replace(/^(?:[*-])\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="my-1">$1</ul>')

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
  html = html.replace(/((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="my-1">$1</ol>')

  // Tables — detect lines with | separators
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim())
    if (rows.length < 2) return tableBlock
    // Check if row 2 is a separator (|---|---|)
    const isSep = (r) => /^\|[\s:|-]+\|$/.test(r.trim())
    let headerEnd = isSep(rows[1]) ? 1 : 0
    const parseRow = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    let out = '<div class="overflow-x-auto my-2"><table class="min-w-full text-xs border-collapse border border-gray-300">'
    rows.forEach((row, i) => {
      if (isSep(row)) return // skip separator row
      const cells = parseRow(row)
      const isHeader = i < headerEnd || (headerEnd === 0 && i === 0 && rows.length > 2 && isSep(rows[1]))
      const tag = isHeader ? 'th' : 'td'
      const cls = isHeader ? 'bg-gray-100 font-semibold text-left px-2 py-1 border border-gray-300' : 'px-2 py-1 border border-gray-300'
      out += '<tr>' + cells.map(c => `<${tag} class="${cls}">${c}</${tag}>`).join('') + '</tr>'
    })
    out += '</table></div>'
    return out
  })

  // Paragraphs (double newlines)
  html = html.replace(/\n\n+/g, '</p><p class="my-1">')
  html = '<p class="my-1">' + html + '</p>'

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-1">\s*<\/p>/g, '')
  // Don't wrap block elements in <p>
  html = html.replace(/<p class="my-1">(<(?:div|table|h[1-6]|ul|ol|pre|hr|blockquote))/g, '$1')
  html = html.replace(/(<\/(?:div|table|h[1-6]|ul|ol|pre|hr|blockquote)>)<\/p>/g, '$1')

  return html
}

// ─── Markdown Block ──────────────────────────────────────────────────────────

const MarkdownBlock = ({ content, maxHeight = 'max-h-[600px]', onAnnotate, highlightText }) => {
  const [viewMode, setViewMode] = useState('rendered')
  const [ctxMenu, setCtxMenu] = useState(null) // {x, y, selectedText}
  const [annotateText, setAnnotateText] = useState('')
  const containerRef = useRef(null)

  // Scroll to and highlight matching text when highlightText changes
  useEffect(() => {
    if (!highlightText || !containerRef.current) return
    const searchStr = highlightText.slice(0, 40)
    // Use TreeWalker to find text nodes containing the search string
    const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT, null)
    let node
    while ((node = walker.nextNode())) {
      if (node.textContent.includes(searchStr)) {
        // Found the text node — wrap in a highlight span
        const range = document.createRange()
        const idx = node.textContent.indexOf(searchStr)
        range.setStart(node, idx)
        range.setEnd(node, Math.min(idx + highlightText.length, node.textContent.length))
        // Scroll into view
        const rect = range.getBoundingClientRect()
        const container = containerRef.current
        const containerRect = container.getBoundingClientRect()
        container.scrollTop += rect.top - containerRect.top - 80
        // Flash highlight using CSS animation on a temporary mark element
        const mark = document.createElement('mark')
        mark.className = 'bg-amber-200 transition-all duration-1000 rounded px-0.5'
        range.surroundContents(mark)
        setTimeout(() => {
          mark.classList.replace('bg-amber-200', 'bg-transparent')
          setTimeout(() => {
            // Unwrap the mark
            const parent = mark.parentNode
            if (parent) {
              parent.replaceChild(document.createTextNode(mark.textContent), mark)
              parent.normalize()
            }
          }, 1000)
        }, 2000)
        break
      }
    }
  }, [highlightText])

  if (!content) return null
  const rendered = viewMode === 'rendered'

  const handleContextMenu = (e) => {
    const sel = window.getSelection()
    const selectedText = sel?.toString().trim()
    if (!selectedText || !onAnnotate) return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    setCtxMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      selectedText,
    })
    setAnnotateText('')
  }

  const handleAnnotateSubmit = () => {
    if (!ctxMenu || !annotateText.trim()) return
    onAnnotate({
      text: annotateText.trim(),
      section: ctxMenu.selectedText.slice(0, 120),
    })
    setCtxMenu(null)
    setAnnotateText('')
  }

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!ctxMenu) return
    const close = (e) => {
      if (!e.target.closest('.annotation-ctx-menu')) setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctxMenu])

  return (
    <div ref={containerRef} className={`relative ${maxHeight} overflow-y-auto bg-white rounded-lg border border-gray-200 p-4`} onContextMenu={handleContextMenu}>
      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-white/90 backdrop-blur-sm rounded px-1.5 py-0.5 border border-gray-200 z-10">
        <button className={rendered ? 'font-bold text-amber-700' : 'text-gray-500 hover:text-gray-700'} onClick={() => setViewMode('rendered')}>Rendered</button>
        <span className="text-gray-300">|</span>
        <button className={!rendered ? 'font-bold text-amber-700' : 'text-gray-500 hover:text-gray-700'} onClick={() => setViewMode('raw')}>Raw</button>
      </div>
      {rendered ? (
        <div
          className="prose prose-sm max-w-none text-xs leading-relaxed text-gray-700 pt-4"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      ) : (
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 font-mono pt-4">{content}</pre>
      )}

      {/* Right-click annotation context menu */}
      {ctxMenu && (
        <div
          className="annotation-ctx-menu absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-72"
          style={{ left: Math.min(ctxMenu.x, 300), top: ctxMenu.y }}
        >
          <div className="text-[10px] text-gray-400 mb-1 truncate">
            Selected: <span className="italic">"{ctxMenu.selectedText.slice(0, 60)}{ctxMenu.selectedText.length > 60 ? '...' : ''}"</span>
          </div>
          <textarea
            value={annotateText}
            onChange={e => setAnnotateText(e.target.value)}
            placeholder="Add your annotation..."
            rows={2}
            autoFocus
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none mb-2"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnnotateSubmit() } }}
          />
          <div className="flex items-center justify-between">
            <button onClick={() => setCtxMenu(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
            <button
              onClick={handleAnnotateSubmit}
              disabled={!annotateText.trim()}
              className="px-2.5 py-1 text-[10px] font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
            >Annotate</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Run Form ──────────────────────────────────────────────────────────

const RunForm = ({ onSubmit, disabled }) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState('paper')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContent(ev.target.result)
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsText(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({
      title: title || `Run ${new Date().toLocaleString()}`,
      content,
      contentType,
      context: showContext ? context : undefined,
      pipelineType: 'cross-model',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Run title (optional)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
        />
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="paper">Paper</option>
          <option value="transcript">Transcript</option>
          <option value="blog">Blog/Article</option>
          <option value="notes">Notes</option>
        </select>
      </div>

      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste research content here, or upload a file..."
          rows={8}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-y"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Upload file"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept=".md,.txt,.json" onChange={handleFile} className="hidden" />
      </div>

      {content && (
        <div className="text-xs text-gray-400">
          {(content.length / 1000).toFixed(1)}K chars
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showContext ? 'rotate-180' : ''}`} />
          Optional: Project context override
        </button>
        {showContext && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste CLAUDE.md or project context (overrides default)..."
            rows={4}
            className="w-full mt-2 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 resize-y"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !content.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Play className="w-4 h-4" />
        Run Pipeline
      </button>
    </form>
  )
}

// ─── Run History Item ──────────────────────────────────────────────────────

const RunHistoryItem = ({ run, selected, onSelect, onDelete }) => {
  const badge = STATUS_BADGE[run.status] || STATUS_BADGE.pending
  const Icon = run.status === 'running' ? Loader2 : badge.icon
  const completedStages = run.stages?.filter(s => s.status === 'complete').length || 0

  return (
    <div
      onClick={() => onSelect(run.id)}
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${badge.bg}`}>
          <Icon className={`w-4 h-4 ${badge.text} ${run.status === 'running' ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
            {run.title}
            {run.isBaseline && (
              <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-200 text-amber-800">BASELINE</span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(run.createdAt).toLocaleString()}
            <span className="mx-1">&middot;</span>
            {run.contentType}
            <span className="mx-1">&middot;</span>
            {completedStages}/3 stages
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!run.isBaseline && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(run.id) }}
            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
            title="Delete run"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </div>
  )
}

// ─── Annotations Panel ──────────────────────────────────────────────────────
// TODO: Add server endpoints: POST /api/pipeline/run/:runId/annotations
//       and GET /api/pipeline/run/:runId/annotations for persistent storage.

const AnnotationsPanel = ({ runId, onJumpToSection }) => {
  const storageKey = `annotations-${runId}`
  const [annotations, setAnnotations] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [noteText, setNoteText] = useState('')
  const [noteSection, setNoteSection] = useState('')

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(annotations))
  }, [annotations, storageKey])

  const handleAdd = () => {
    if (!noteText.trim()) return
    setAnnotations(prev => [{
      id: crypto.randomUUID(),
      text: noteText.trim(),
      section: noteSection.trim() || undefined,
      createdAt: new Date().toISOString(),
    }, ...prev])
    setNoteText('')
    setNoteSection('')
  }

  const handleDelete = (id) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        Annotations ({annotations.length})
      </h4>
      <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add a research note..."
          rows={2}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300 resize-y"
        />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={noteSection}
            onChange={e => setNoteSection(e.target.value)}
            placeholder="Section reference (optional)"
            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
          />
          <button
            onClick={handleAdd}
            disabled={!noteText.trim()}
            className="px-3 py-1 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >Add Note</button>
        </div>
      </div>
      {annotations.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No annotations yet. Add notes about this run above.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {annotations.map(a => (
            <div key={a.id} className="p-2.5 bg-white rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">{a.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                    {a.section && (
                      <button
                        onClick={() => onJumpToSection?.(a.section)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer max-w-xs truncate text-left"
                        title={`Jump to: "${a.section}"`}
                      >
                        ↗ {a.section}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete annotation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NotebookLM Panel ──────────────────────────────────────────────────────

const NblmPanel = ({ runId, run }) => {
  const [nblmState, setNblmState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pollInterval, setPollInterval] = useState(null)

  // Load existing NBLM state
  useEffect(() => {
    fetch(`/api/pipeline/run/${runId}/nblm`).then(r => r.ok ? r.json() : {}).then(setNblmState).catch(() => {})
  }, [runId])

  // Poll for audio status when generating
  useEffect(() => {
    if (!nblmState?.audioGenerating || !nblmState?.notebookId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/run/${runId}/nblm`)
        if (res.ok) {
          const state = await res.json()
          setNblmState(state)
          if (state.audioStatus === 'completed' || state.audioStatus === 'failed') {
            clearInterval(interval)
          }
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [nblmState?.audioGenerating, nblmState?.notebookId, runId])

  const saveState = async (update) => {
    const newState = { ...nblmState, ...update }
    setNblmState(newState)
    await fetch(`/api/pipeline/run/${runId}/nblm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState),
    })
  }

  const hasNotebook = nblmState?.notebookId
  const hasAudio = nblmState?.audioUrl

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        🎙️ NotebookLM Audio
      </h4>

      {!hasNotebook ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center space-y-3">
          <p className="text-sm text-gray-600">
            Generate an audio podcast from this pipeline's research output.
            NotebookLM creates a two-speaker deep-dive discussion grounded entirely in the source material.
          </p>
          <p className="text-xs text-gray-400">
            Pipeline output will be added as sources → Audio dialogue generated → Playable here
          </p>
          <button
            onClick={async () => {
              setLoading(true)
              // This triggers the MCP flow — notebook creation, source upload, and audio generation
              // happen via the Claude Code session (MCP tools), then state is saved via API
              // For now, show instructions for manual triggering
              await saveState({ pendingCreation: true, createdAt: new Date().toISOString() })
              setLoading(false)
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Create Audio Overview
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Notebook link */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Notebook:</span>
            <a
              href={nblmState.notebookUrl || `https://notebooklm.google.com/notebook/${nblmState.notebookId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-800 underline"
            >
              Open in NotebookLM ↗
            </a>
            {nblmState.sourceCount && (
              <span className="text-gray-400">({nblmState.sourceCount} sources)</span>
            )}
          </div>

          {/* Audio status */}
          {nblmState.audioGenerating && nblmState.audioStatus !== 'completed' && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-sm text-purple-700">
                Generating audio overview... This takes 3-5 minutes.
              </span>
            </div>
          )}

          {/* Audio player */}
          {hasAudio && (
            <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">🎧 Audio Overview — Deep Dive</span>
                {nblmState.audioPath && (
                  <a
                    href={nblmState.audioPath}
                    download
                    className="text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    Download
                  </a>
                )}
              </div>
              <audio
                controls
                src={nblmState.audioUrl || nblmState.audioPath}
                className="w-full h-10"
                preload="metadata"
              >
                Your browser does not support audio playback.
              </audio>
              {nblmState.audioDuration && (
                <span className="text-[10px] text-gray-400">
                  Duration: {Math.floor(nblmState.audioDuration / 60)}:{String(nblmState.audioDuration % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          )}

          {/* Additional artifacts */}
          {nblmState.artifacts && nblmState.artifacts.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-gray-500">Additional Artifacts</span>
              {nblmState.artifacts.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700">{a.type}: {a.title || a.artifact_id?.slice(0, 8)}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                      a.status === 'completed' ? 'bg-green-100 text-green-700' :
                      a.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{a.status}</span>
                  </div>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-600 hover:underline">View ↗</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Generate more artifacts */}
          {!nblmState.audioGenerating && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => saveState({ requestedArtifact: 'briefing_doc' })}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                📄 Briefing Doc
              </button>
              <button
                onClick={() => saveState({ requestedArtifact: 'study_guide' })}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                📚 Study Guide
              </button>
              <button
                onClick={() => saveState({ requestedArtifact: 'mind_map' })}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                🧠 Mind Map
              </button>
              <button
                onClick={() => saveState({ requestedArtifact: 'quiz' })}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                ❓ Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Run Detail View ──────────────────────────────────────────────────────

const RunDetailView = ({ run, onBack }) => {
  const [activeStage, setActiveStage] = useState(0)
  const [activePanel, setActivePanel] = useState('output') // output | researchers | findings | annotations | audio
  const [customResearchers, setCustomResearchers] = useState(() => getCustomResearchers())

  if (!run) return null

  const stageFileMap = [
    'stage-1-claude-synthesis.md',
    'stage-2-gemini-reasoning.md',
    'stage-3-agent-team-execution.md',
  ]

  const stageContent = run.outputs?.[stageFileMap[activeStage]] || null
  const researchers = useMemo(() => extractResearchers(run.outputs, customResearchers), [run.outputs, customResearchers])
  const findings = useMemo(() => extractFindings(run.outputs), [run.outputs])

  // Annotations count for badge (read from localStorage)
  const annotationCount = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`annotations-${run.id}`) || '[]').length } catch { return 0 }
  }, [run.id, activePanel]) // re-check when panel switches

  const handleAddCustomResearcher = (researcher) => {
    const updated = [...customResearchers, researcher]
    setCustomResearchers(updated)
    saveCustomResearchers(updated)
  }

  const handleDeleteCustomResearcher = (name) => {
    const updated = customResearchers.filter(r => r.name !== name)
    setCustomResearchers(updated)
    saveCustomResearchers(updated)
  }

  // Allow MarkdownBlock right-click annotations to flow into the annotations store
  const handleInlineAnnotate = useCallback(({ text, section }) => {
    const key = `annotations-${run.id}`
    const existing = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } })()
    const updated = [{
      id: crypto.randomUUID(),
      text,
      section,
      createdAt: new Date().toISOString(),
    }, ...existing]
    localStorage.setItem(key, JSON.stringify(updated))
    // Flash to annotations panel to show the new note
    setActivePanel('annotations')
  }, [run.id])

  // Jump to a section in the output — switches to Stage Outputs, finds text, highlights it
  const [highlightText, setHighlightText] = useState(null)
  const handleJumpToSection = useCallback((sectionText) => {
    setActivePanel('output')
    // Try to find which stage contains this text
    const stageFiles = [
      'stage-1-claude-synthesis.md',
      'stage-2-gemini-reasoning.md',
      'stage-3-agent-team-execution.md',
      'pipeline-complete.md',
    ]
    if (run.outputs) {
      for (let i = 0; i < stageFiles.length; i++) {
        const content = run.outputs[stageFiles[i]]
        if (content && content.includes(sectionText.slice(0, 40))) {
          setActiveStage(i === 3 ? 3 : i)
          break
        }
      }
    }
    setHighlightText(sectionText)
    // Clear highlight after 4 seconds
    setTimeout(() => setHighlightText(null), 4000)
  }, [run.outputs])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back
        </button>
        <span className="text-gray-300">|</span>
        <h3 className="text-sm font-medium text-gray-900">{run.title}</h3>
        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[run.status]?.bg} ${STATUS_BADGE[run.status]?.text}`}>
          {run.status}
        </span>
        {run.isBaseline && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-200 text-amber-800 font-semibold">
            BASELINE
          </span>
        )}
      </div>

      <PipelineStepper stages={run.stages || []} />

      {run.status === 'running' && run.log?.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
            {(run.log || []).slice(-10).join('')}
          </pre>
        </div>
      )}

      {run.status === 'error' && run.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{run.error}</p>
        </div>
      )}

      {/* Panel switcher */}
      {run.outputs && Object.keys(run.outputs).length > 0 && (
        <div>
          <div className="flex gap-1 mb-3 border-b border-gray-200 pb-2">
            <button
              onClick={() => setActivePanel('output')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                activePanel === 'output' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            ><FileText className="w-3 h-3" /> Stage Outputs</button>
            {researchers.length > 0 && (
              <button
                onClick={() => setActivePanel('researchers')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                  activePanel === 'researchers' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              ><User className="w-3 h-3" /> Researchers ({researchers.length})</button>
            )}
            {findings.length > 0 && (
              <button
                onClick={() => setActivePanel('findings')}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                  activePanel === 'findings' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              ><Tag className="w-3 h-3" /> Findings ({findings.length})</button>
            )}
            <button
              onClick={() => setActivePanel('annotations')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                activePanel === 'annotations' ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >📝 Annotations ({annotationCount})</button>
            <button
              onClick={() => setActivePanel('audio')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                activePanel === 'audio' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >🎙️ Audio</button>
          </div>

          {activePanel === 'researchers' && <ResearcherCards researchers={researchers} onAddCustom={handleAddCustomResearcher} onDeleteCustom={handleDeleteCustomResearcher} />}
          {activePanel === 'findings' && <FindingsPanel findings={findings} />}
          {activePanel === 'annotations' && <AnnotationsPanel runId={run.id} onJumpToSection={handleJumpToSection} />}
          {activePanel === 'audio' && <NblmPanel runId={run.id} run={run} />}
          {activePanel === 'output' && (
            <>
              <div className="flex gap-1 mb-3">
                {STAGE_NAMES.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStage(i)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeStage === i
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Stage {i + 1}: {name}
                  </button>
                ))}
                <button
                  onClick={() => setActiveStage(3)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeStage === 3
                      ? 'bg-amber-100 text-amber-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Full Output
                </button>
              </div>
              <MarkdownBlock
                content={
                  activeStage === 3
                    ? run.outputs['pipeline-complete.md']
                    : stageContent
                }
                maxHeight="max-h-[70vh]"
                onAnnotate={handleInlineAnnotate}
                highlightText={highlightText}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Research Tab ──────────────────────────────────────────────────────

export default function ResearchTab() {
  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [activeRunId, setActiveRunId] = useState(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  // Fetch run list
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline/runs?t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setRuns(data)
        const running = data.find(r => r.status === 'running')
        if (running) setActiveRunId(running.id)
        else setActiveRunId(null)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchRuns])

  // Poll active run status more frequently
  useEffect(() => {
    if (!activeRunId) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    const poll = async () => {
      try {
        const res = await fetch(`/api/pipeline/status/${activeRunId}?t=${Date.now()}`)
        if (res.ok) {
          const status = await res.json()
          setRuns(prev => prev.map(r =>
            r.id === activeRunId ? { ...r, ...status } : r
          ))
          if (selectedRunId === activeRunId) {
            setSelectedRun(prev => prev ? { ...prev, ...status, log: status.logTail ? [status.logTail] : prev?.log } : prev)
          }
          if (status.status !== 'running') {
            setActiveRunId(null)
            fetchRuns()
          }
        }
      } catch {}
    }
    pollRef.current = setInterval(poll, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeRunId, selectedRunId, fetchRuns])

  // Fetch full run details when selected
  useEffect(() => {
    if (!selectedRunId) { setSelectedRun(null); return }
    const fetchRun = async () => {
      try {
        const res = await fetch(`/api/pipeline/run/${selectedRunId}?t=${Date.now()}`)
        if (res.ok) setSelectedRun(await res.json())
      } catch {}
    }
    fetchRun()
  }, [selectedRunId])

  const handleSubmit = async (formData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        const { id } = await res.json()
        setActiveRunId(id)
        setSelectedRunId(id)
        fetchRuns()
      }
    } catch {}
    setLoading(false)
  }

  const handleDelete = async (runId) => {
    try {
      await fetch(`/api/pipeline/run/${runId}`, { method: 'DELETE' })
      if (selectedRunId === runId) setSelectedRunId(null)
      fetchRuns()
    } catch {}
  }

  const baselineRuns = runs.filter(r => r.isBaseline)
  const regularRuns = runs.filter(r => !r.isBaseline)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Research Pipeline</h2>
          <p className="text-sm text-gray-500">Cross-model reasoning: Claude &rarr; Gemini &rarr; Claude</p>
        </div>
        <button
          onClick={fetchRuns}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {selectedRunId ? (
        <RunDetailView
          run={selectedRun || runs.find(r => r.id === selectedRunId)}
          onBack={() => setSelectedRunId(null)}
        />
      ) : (
        <>
          {/* New Run Form */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-500" />
              New Pipeline Run
            </h3>
            <RunForm onSubmit={handleSubmit} disabled={loading || !!activeRunId} />
            {activeRunId && (
              <p className="text-xs text-amber-600 mt-2">A pipeline is currently running. Wait for it to complete.</p>
            )}
          </div>

          {/* Active Run Progress */}
          {activeRunId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-blue-200"
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                Running Pipeline
              </h3>
              <PipelineStepper stages={runs.find(r => r.id === activeRunId)?.stages || []} />
              <button
                onClick={() => setSelectedRunId(activeRunId)}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View details <ChevronRight className="w-3 h-3" />
              </button>
            </motion.div>
          )}

          {/* Baselines */}
          {baselineRuns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Baselines ({baselineRuns.length})
              </h3>
              <div className="space-y-2">
                {baselineRuns.map(run => (
                  <RunHistoryItem
                    key={run.id}
                    run={run}
                    selected={selectedRunId === run.id}
                    onSelect={setSelectedRunId}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Run History */}
          {regularRuns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Run History ({regularRuns.length})
              </h3>
              <div className="space-y-2">
                {regularRuns.map(run => (
                  <RunHistoryItem
                    key={run.id}
                    run={run}
                    selected={selectedRunId === run.id}
                    onSelect={setSelectedRunId}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {runs.length === 0 && !activeRunId && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No pipeline runs yet. Paste content above to start.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
