import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import {
  FlaskConical, TrendingUp, Target, Hash, Clock, Zap, DollarSign,
  CheckCircle, XCircle, RotateCcw, Github, Settings, ChevronDown,
  FileText, X, BarChart3, BookOpen, Play, Square, Terminal, Plus, Trash2, Save, ListChecks,
  Microscope
} from 'lucide-react'
import ResearchTab from './ResearchTab'

const REFRESH_INTERVAL = 30_000

// ─── Reusable Mini Dropdown ──────────────────────────────────────────────────

const MiniDropdown = ({ options, selected, onSelect, label }) => {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find(o => o.id === selected)?.label || selected
  return (
    <div className="relative inline-block">
      {label && <span className="text-xs text-gray-400 mr-1.5">{label}</span>}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
      >
        <span className="font-mono">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-30 min-w-[220px]">
            {options.map(o => (
              <button
                key={o.id}
                onClick={() => { onSelect(o.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                  o.id === selected ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'
                }`}
              >
                <span className="font-mono">{o.label}</span>
                {o.sub && <span className="text-gray-400 ml-1.5">{o.sub}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const SKILL_OPTIONS = (skills) => skills.map(s => ({ id: s, label: s }))

const EVALUATOR_OPTIONS = [
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', sub: 'Best' },
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', sub: 'Fast' },
  { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash', sub: 'Cheapest' },
  { id: 'gemini-3-pro-preview', label: 'gemini-3-pro', sub: 'Preview' },
]

const MUTATOR_OPTIONS = [
  { id: 'sonnet', label: 'sonnet', sub: 'CLI · Max plan' },
  { id: 'opus', label: 'opus', sub: 'CLI · Max plan' },
  { id: 'haiku', label: 'haiku', sub: 'CLI · Max plan' },
  { id: 'claude-3-haiku-20240307', label: 'claude-3-haiku', sub: 'API · $0.25/1M' },
  { id: 'claude-sonnet-4-5-20250514', label: 'claude-sonnet-4.5', sub: 'API · $3/1M' },
  { id: 'claude-opus-4-6-20250801', label: 'claude-opus-4.6', sub: 'API · $15/1M' },
]

// ─── Configuration Panel ─────────────────────────────────────────────────────

const ConfigPanel = ({ config, onUpdate, visible, maxScore }) => {
  if (!visible) return null
  const skill = config.selectedSkill || 'my-skill'
  const cliBase = `--skill ${skill} --evaluator ${config.evaluator} --mutator ${config.mutator} --target ${config.targetScore} --continuous --dashboard-sync --tui`
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"
    >
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-gray-400">Target:</span>
          <input type="number" value={config.targetScore}
            onChange={e => onUpdate({ ...config, targetScore: parseInt(e.target.value) || 60 })}
            className="w-16 px-2 py-1 text-xs font-mono border border-gray-200 rounded-lg text-center"
            min={1} />
          {maxScore && config.targetScore > maxScore && (
            <span className="text-xs text-amber-500">current max: {maxScore} — add more scenarios/criteria to reach {config.targetScore}</span>
          )}
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-gray-400">Refresh:</span>
          <input type="number" value={config.refreshInterval / 1000}
            onChange={e => onUpdate({ ...config, refreshInterval: parseInt(e.target.value) * 1000 })}
            className="w-14 px-2 py-1 text-xs font-mono border border-gray-200 rounded-lg text-center"
            min={5} max={300} />
          <span className="text-xs text-gray-400">s</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center space-x-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
              <span className="text-green-700 text-xs font-bold">N</span>
            </div>
            <span className="text-xs font-semibold text-gray-600">Node.js</span>
          </div>
          <code className="text-[11px] font-mono text-gray-700 leading-relaxed block">
            node skills/autoresearch-runner.mjs \<br/>
            &nbsp;&nbsp;{cliBase}
          </code>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center space-x-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 text-xs font-bold">Py</span>
            </div>
            <span className="text-xs font-semibold text-gray-600">Python</span>
          </div>
          <code className="text-[11px] font-mono text-gray-700 leading-relaxed block">
            python3 skills/autoresearch-runner.py \<br/>
            &nbsp;&nbsp;{cliBase}
          </code>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

// ─── Eval Suite Editor ───────────────────────────────────────────────────────

const EvalEditor = ({ skill, visible, onMaxChange }) => {
  const [evalData, setEvalData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState(null)
  const [lastGenCost, setLastGenCost] = useState(null)

  useEffect(() => {
    if (!skill) return
    setError(null)
    setDirty(false)
    fetch(`/api/eval/${skill}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(d => { setEvalData(d); setDirty(false) })
      .catch(e => setError(`Load failed: ${e.message}`))
  }, [skill])

  if (!visible || !evalData) return null

  const max = evalData.scenarios.length * evalData.criteria.length

  const updateScenario = (idx, field, value) => {
    const updated = { ...evalData, scenarios: evalData.scenarios.map((s, i) => i === idx ? { ...s, [field]: value } : s) }
    setEvalData(updated)
    setDirty(true)
  }

  const addScenario = () => {
    const newId = Math.max(0, ...evalData.scenarios.map(s => s.id)) + 1
    setEvalData({ ...evalData, scenarios: [...evalData.scenarios, { id: newId, type: '', title: '', event: '', expectedAction: '', expectedType: '' }] })
    setDirty(true)
  }

  const removeScenario = (idx) => {
    setEvalData({ ...evalData, scenarios: evalData.scenarios.filter((_, i) => i !== idx) })
    setDirty(true)
  }

  const updateCriterion = (idx, value) => {
    const updated = { ...evalData, criteria: evalData.criteria.map((c, i) => i === idx ? value : c) }
    setEvalData(updated)
    setDirty(true)
  }

  const addCriterion = () => {
    setEvalData({ ...evalData, criteria: [...evalData.criteria, 'New Criterion: Does the skill do X?'] })
    setDirty(true)
  }

  const removeCriterion = (idx) => {
    setEvalData({ ...evalData, criteria: evalData.criteria.filter((_, i) => i !== idx) })
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const { _cost, ...cleanData } = evalData
      const res = await fetch(`/api/eval/${skill}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      const result = await res.json()
      setDirty(false)
      if (onMaxChange) onMaxChange(result.max)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const PLACEHOLDER_CRITERION = 'New Criterion: Does the skill do X?'
  const isPlaceholderScenario = (s) => !s.event || s.title === ''

  const generateSection = async (section) => {
    setGenerating(true)
    setError(null)
    try {
      // Count how many placeholders need filling
      const placeholderCount = section === 'criteria'
        ? evalData.criteria.filter(c => c === PLACEHOLDER_CRITERION).length
        : evalData.scenarios.filter(isPlaceholderScenario).length
      const genCount = placeholderCount > 0 ? placeholderCount : 5

      const body = section === 'criteria'
        ? { scenarios: evalData.scenarios.length, criteria: genCount }
        : { scenarios: genCount, criteria: evalData.criteria.length }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120000)
      const res = await fetch(`/api/generate-eval/${skill}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`Generate failed: ${res.status}`)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      if (d._cost) setLastGenCost(d._cost)

      if (section === 'criteria' && d.criteria) {
        if (placeholderCount > 0) {
          // Replace placeholders with generated content
          let genIdx = 0
          setEvalData(prev => ({
            ...prev,
            criteria: prev.criteria.map(c =>
              c === PLACEHOLDER_CRITERION && genIdx < d.criteria.length ? d.criteria[genIdx++] : c
            ),
          }))
        } else {
          setEvalData(prev => ({ ...prev, criteria: [...prev.criteria, ...d.criteria] }))
        }
      } else if (section === 'scenarios' && d.scenarios) {
        if (placeholderCount > 0) {
          let genIdx = 0
          const maxId = Math.max(0, ...evalData.scenarios.map(s => s.id))
          setEvalData(prev => ({
            ...prev,
            scenarios: prev.scenarios.map(s =>
              isPlaceholderScenario(s) && genIdx < d.scenarios.length
                ? { ...d.scenarios[genIdx++], id: s.id }
                : s
            ),
          }))
        } else {
          const maxId = Math.max(0, ...evalData.scenarios.map(s => s.id))
          const reindexed = d.scenarios.map((s, i) => ({ ...s, id: maxId + i + 1 }))
          setEvalData(prev => ({ ...prev, scenarios: [...prev.scenarios, ...reindexed] }))
        }
      }
      setDirty(true)
    } catch (e) { setError(e.message) }
    setGenerating(false)
  }

  const newMax = evalData.scenarios.length * evalData.criteria.length
  const inputClass = "w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-transparent"

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ListChecks className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Eval Suite</h3>
          <span className="text-xs text-gray-400">{evalData.scenarios.length} scenarios × {evalData.criteria.length} criteria = <span className="font-semibold text-gray-600">{newMax} max</span></span>
        </div>
        <div className="flex items-center space-x-2">
          {dirty && <span className="text-xs text-amber-500">unsaved</span>}
          <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); save() }} disabled={!dirty || saving}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              dirty ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-3 h-3" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>
      )}

      {generating && (
        <div className="flex items-center space-x-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-purple-700 font-medium">Generating with Gemini — reading SKILL.md and producing eval suite...</span>
        </div>
      )}
      {!generating && lastGenCost && (
        <div className="flex items-center space-x-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-green-700">Generated — {lastGenCost.prompt} input + {lastGenCost.output} output tokens — <span className="font-semibold">${lastGenCost.usd.toFixed(4)}</span></span>
        </div>
      )}

      {/* Criteria */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Criteria ({evalData.criteria.length})</span>
          <div className="flex items-center space-x-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); generateSection('criteria') }} disabled={generating}
              className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50">
              <FlaskConical className="w-3 h-3" /><span>{generating ? 'Generating...' : 'Generate'}</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); addCriterion() }} className="inline-flex items-center space-x-1 text-xs text-amber-600 hover:text-amber-700">
              <Plus className="w-3 h-3" /><span>Add</span>
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {evalData.criteria.map((c, i) => (
            <div key={i} className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
              <input value={c} onChange={e => updateCriterion(i, e.target.value)} className={inputClass} />
              <button onClick={() => removeCriterion(i)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase">Scenarios ({evalData.scenarios.length})</span>
          <div className="flex items-center space-x-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); generateSection('scenarios') }} disabled={generating}
              className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50">
              <FlaskConical className="w-3 h-3" /><span>{generating ? 'Generating...' : 'Generate'}</span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); addScenario() }} className="inline-flex items-center space-x-1 text-xs text-amber-600 hover:text-amber-700">
              <Plus className="w-3 h-3" /><span>Add</span>
            </button>
          </div>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {evalData.scenarios.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-gray-400">#{s.id}</span>
                  <input value={s.title} onChange={e => updateScenario(i, 'title', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs font-medium w-48" placeholder="Title" />
                  <input value={s.type} onChange={e => updateScenario(i, 'type', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-500 w-28" placeholder="Type" />
                </div>
                <button onClick={() => removeScenario(i)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <textarea value={s.event} onChange={e => updateScenario(i, 'event', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs resize-none" rows={2} placeholder="What happens in this scenario..." />
              <div className="flex space-x-2 mt-1.5">
                <input value={s.expectedAction} onChange={e => updateScenario(i, 'expectedAction', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs" placeholder="Expected action" />
                <input value={s.expectedType} onChange={e => updateScenario(i, 'expectedType', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs" placeholder="Expected type" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── BYOK Setup Panel ────────────────────────────────────────────────────────

const KeySetup = ({ visible, onClose }) => {
  const [keys, setKeys] = useState({ gemini: '', anthropic: '' })
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [keyInfo, setKeyInfo] = useState(null)

  useEffect(() => {
    fetch('/api/keys').then(r => r.ok ? r.json() : null).then(d => { if (d) setKeyInfo(d) }).catch(() => {})
  }, [visible])

  if (!visible) return null

  const validate = async () => {
    setSaving(true)
    setStatus(null)
    const body = {}
    if (keys.gemini) body.gemini = keys.gemini
    if (keys.anthropic) body.anthropic = keys.anthropic
    try {
      const res = await fetch('/api/keys/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      setStatus(result)
    } catch {}
    setSaving(false)
  }

  const save = async () => {
    setSaving(true)
    const body = {}
    if (keys.gemini) body.gemini = keys.gemini
    if (keys.anthropic) body.anthropic = keys.anthropic
    try {
      await fetch('/api/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setKeyInfo(prev => ({
        ...prev,
        gemini: keys.gemini ? { configured: true, masked: `${keys.gemini.slice(0, 8)}...` } : prev?.gemini,
        anthropic: keys.anthropic ? { configured: true, masked: `${keys.anthropic.slice(0, 12)}...` } : prev?.anthropic,
      }))
      setKeys({ gemini: '', anthropic: '' })
    } catch {}
    setSaving(false)
  }

  const inputClass = "w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">API Keys</h3>
        </div>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {/* Current status */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={`rounded-lg p-3 text-xs ${keyInfo?.gemini?.configured ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="font-semibold text-gray-700 mb-1">Gemini</div>
          {keyInfo?.gemini?.configured
            ? <div className="text-green-600 font-mono">{keyInfo.gemini.masked}</div>
            : <div className="text-gray-400">Not configured</div>}
        </div>
        <div className={`rounded-lg p-3 text-xs ${keyInfo?.anthropic?.configured ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="font-semibold text-gray-700 mb-1">Anthropic API</div>
          {keyInfo?.anthropic?.configured
            ? <div className="text-green-600 font-mono">{keyInfo.anthropic.masked}</div>
            : <div className="text-gray-400">Optional</div>}
        </div>
        <div className={`rounded-lg p-3 text-xs ${keyInfo?.cli?.available ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="font-semibold text-gray-700 mb-1">Claude CLI</div>
          {keyInfo?.cli?.available
            ? <div className="text-green-600">Available (Max plan)</div>
            : <div className="text-gray-400">Not installed</div>}
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Gemini API Key <span className="text-red-400">*required</span>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="ml-2 text-amber-600 hover:underline">Get key</a>
          </label>
          <input type="password" value={keys.gemini} onChange={e => setKeys(k => ({ ...k, gemini: e.target.value }))}
            className={inputClass} placeholder="AIza..." />
          {status?.gemini && (
            <p className={`text-xs mt-1 ${status.gemini.valid ? 'text-green-600' : 'text-red-500'}`}>
              {status.gemini.valid ? `Valid — ${status.gemini.models} models available` : status.gemini.error}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Anthropic API Key <span className="text-gray-400">optional if using Claude CLI</span>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="ml-2 text-amber-600 hover:underline">Get key</a>
          </label>
          <input type="password" value={keys.anthropic} onChange={e => setKeys(k => ({ ...k, anthropic: e.target.value }))}
            className={inputClass} placeholder="sk-ant-..." />
          {status?.anthropic && (
            <p className={`text-xs mt-1 ${status.anthropic.valid ? 'text-green-600' : 'text-red-500'}`}>
              {status.anthropic.valid ? 'Valid' : status.anthropic.error}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 mt-4">
        <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); validate() }} disabled={!keys.gemini && !keys.anthropic}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
          {saving ? 'Validating...' : 'Validate'}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); save() }} disabled={!keys.gemini && !keys.anthropic}
          className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
          Save to .env
        </button>
        <span className="text-xs text-gray-400 ml-2">Keys stored locally, never committed</span>
      </div>
    </motion.div>
  )
}

const MetricCard = ({ label, value, color, icon: Icon, sub }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"
  >
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
    </div>
    <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </motion.div>
)

// ─── Chart Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-xl max-w-xs">
      <div className="font-semibold mb-1">Round {d.round}</div>
      <div className="flex items-center space-x-2 mb-1">
        {d.status === 'kept' || d.status === 'baseline'
          ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          : <XCircle className="w-3.5 h-3.5 text-red-400" />}
        <span className="capitalize">{d.status}</span>
        <span className="text-gray-400">—</span>
        <span>{d.score}/{d.max}</span>
      </div>
      <div className="text-gray-300 text-xs leading-relaxed">{d.mutation}</div>
      {d.cost != null && (
        <div className="text-gray-400 text-xs mt-1">${d.cost.toFixed(2)}</div>
      )}
    </div>
  )
}

// ─── Criteria Heatmap ────────────────────────────────────────────────────────

const CriteriaBreakdown = ({ rounds, criteriaNames }) => {
  if (!rounds.length || !criteriaNames.length) return null

  // Use the latest kept/baseline round for the primary view
  const latest = [...rounds].reverse().find(r => r.criteria) || rounds[0]
  if (!latest?.criteria) return null

  const maxPerCriteria = latest.max / criteriaNames.length
  const sorted = criteriaNames.map((name, i) => ({
    name,
    score: latest.criteria[i] || 0,
    max: maxPerCriteria,
    pct: ((latest.criteria[i] || 0) / maxPerCriteria) * 100,
  })).sort((a, b) => a.pct - b.pct) // weakest first

  const barColor = (pct) => {
    if (pct >= 100) return 'bg-green-500'
    if (pct >= 90) return 'bg-green-400'
    if (pct >= 75) return 'bg-amber-400'
    return 'bg-red-400'
  }

  const perfect = sorted.filter(c => c.pct >= 100).length
  const weak = sorted.filter(c => c.pct < 90).length

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Criteria Breakdown</h3>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-green-600 font-medium">{perfect}/{criteriaNames.length} perfect</span>
          {weak > 0 && <span className="text-red-500 font-medium">{weak} weak</span>}
          <span className="text-gray-400">Round {latest.round}</span>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((c, i) => (
          <div key={i} className="flex items-center space-x-3">
            <span className="text-xs text-gray-600 w-40 truncate flex-shrink-0" title={c.name}>
              {c.name}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2.5 relative">
              <div
                className={`h-2.5 rounded-full transition-all ${barColor(c.pct)}`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-12 text-right flex-shrink-0 ${
              c.pct >= 100 ? 'text-green-600' : c.pct >= 90 ? 'text-amber-600' : 'text-red-500 font-semibold'
            }`}>
              {c.score}/{c.max}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Changelog Panel ─────────────────────────────────────────────────────────

const ChangelogPanel = ({ round, criteriaNames, onClose }) => {
  const [showThoughts, setShowThoughts] = useState(false)
  if (!round) return null
  const maxPerCriteria = round.max / (round.criteria?.length || 6)
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Round {round.round}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                round.status === 'kept' ? 'bg-green-100 text-green-700' :
                round.status === 'baseline' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>{round.status}</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Score + Cost row */}
            <div className="flex items-end space-x-6">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Score</h4>
                <p className="text-3xl font-bold text-gray-900">{round.score}<span className="text-lg text-gray-400">/{round.max}</span></p>
              </div>
              {round.cost != null && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cost</h4>
                  <p className="text-xl font-semibold text-gray-600">${round.cost.toFixed(2)}</p>
                </div>
              )}
              {round.timestamp && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Time</h4>
                  <p className="text-sm text-gray-500">{new Date(round.timestamp).toLocaleTimeString()}</p>
                </div>
              )}
            </div>

            {/* Models used */}
            {round.models && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Models Used</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Evaluator:</span>
                    <span className="ml-1 font-mono text-gray-700">{round.models.evaluator}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Mutator:</span>
                    <span className="ml-1 font-mono text-gray-700">{round.models.mutator}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Decision reason */}
            {round.decisionReason && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Decision</h4>
                <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {round.decisionReason}
                </p>
              </div>
            )}

            {/* Mutation description */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mutation</h4>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{round.mutation}</p>
            </div>

            {/* Per-criteria breakdown */}
            {round.criteria && round.criteria.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Criteria Breakdown</h4>
                <div className="space-y-2">
                  {round.criteria.map((val, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <span className="text-xs text-gray-600 w-32 truncate" title={criteriaNames[i] || `Criterion ${i+1}`}>
                        {criteriaNames[i] || `Criterion ${i+1}`}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${val >= maxPerCriteria ? 'bg-green-500' : val >= maxPerCriteria * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(val / maxPerCriteria) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-mono w-10 text-right">{val}/{maxPerCriteria}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specific failures */}
            {round.failures && round.failures.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Failed Checks ({round.failures.length})
                </h4>
                <div className="space-y-1">
                  {round.failures.map((f, i) => (
                    <div key={i} className="flex items-center space-x-2 text-xs bg-red-50 rounded px-2 py-1.5">
                      <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      <span className="text-red-700">Scenario {f.scenario}</span>
                      <span className="text-red-400">·</span>
                      <span className="text-red-600">{f.criterion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluator Reasoning (Gemini chain-of-thought) */}
            {round.geminiThoughts && (
              <div>
                <button
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="text-sm text-purple-500 hover:text-purple-400 font-medium flex items-center gap-1"
                >
                  {showThoughts ? '\u25BC' : '\u25B8'} Evaluator Reasoning
                </button>
                {showThoughts && (
                  <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto bg-gray-50 border border-gray-200 p-3 rounded-lg leading-relaxed">
                    {round.geminiThoughts}
                  </pre>
                )}
              </div>
            )}

            {/* Full changelog entry */}
            {round.changelog && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Changelog</h4>
                <div className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                  {round.changelog.split('\n').filter(Boolean).map((line, i) => {
                    const rendered = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered }} />
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

function App() {
  const [data, setData] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [error, setError] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [selectedRound, setSelectedRound] = useState(null)
  const [selectedSkill, setSelectedSkill] = useState('deep-plan-v2')
  const [availableSkills, setAvailableSkills] = useState(['deep-plan-v2'])
  const [runnerStatus, setRunnerStatus] = useState({ running: false, pid: null, logTail: '' })
  const [showEvalEditor, setShowEvalEditor] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [activeTab, setActiveTab] = useState('skills')

  // Poll runner status
  useEffect(() => {
    const checkStatus = () => {
      fetch('/api/status').then(r => r.ok ? r.json() : null).then(s => { if (s) setRunnerStatus(s) }).catch(() => {})
    }
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const startRun = async () => {
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: selectedSkill,
          evaluator: config.evaluator,
          mutator: config.mutator,
          target: config.targetScore,
          continuous: true,
        }),
      })
      if (res.ok) setRunnerStatus({ running: true, pid: null, logTail: '' })
    } catch {}
  }

  const stopRun = async () => {
    try {
      await fetch('/api/stop', { method: 'POST' })
      setRunnerStatus({ running: false, pid: null, logTail: '' })
    } catch {}
  }
  const [config, setConfig] = useState({
    resultsUrl: './results.json',
    refreshInterval: REFRESH_INTERVAL,
    evaluator: 'gemini-2.5-pro',
    mutator: 'sonnet',
    selectedSkill: 'deep-plan-v2',
    targetScore: 60,
  })

  // Load skills manifest on mount
  useEffect(() => {
    fetch(`./skills-manifest.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(manifest => {
        if (manifest?.skills) setAvailableSkills(manifest.skills)
        if (manifest?.default) setSelectedSkill(manifest.default)
      })
      .catch(() => {})
  }, [])

  const getUrlForSkill = useCallback((skill) => {
    return `./results-${skill}.json`
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const url = getUrlForSkill(selectedSkill)
      const res = await fetch(`${url}?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      // Support both old array format and new object format
      if (Array.isArray(raw)) {
        setData({ skill: selectedSkill, skills: [selectedSkill], criteria: [], totalCost: 0, rounds: raw })
      } else {
        setData(raw)
        // Sync model selectors with what was actually used
        if (raw.models) {
          setConfig(c => ({
            ...c,
            evaluator: raw.models.evaluator || c.evaluator,
            mutator: raw.models.mutator || c.mutator,
          }))
        }
      }
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    }
  }, [selectedSkill, getUrlForSkill])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, config.refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, config.refreshInterval])

  const results = data?.rounds || []
  const criteriaNames = data?.criteria || []
  const skills = availableSkills

  // Derived metrics
  const baseline = results.find(r => r.status === 'baseline') || results[0]
  const bestResult = results.reduce((best, r) => (!best || r.score > best.score) ? r : best, null)
  const keptCount = results.filter(r => r.status === 'kept' || r.status === 'baseline').length
  const totalRounds = results.length
  const improvementPct = baseline && bestResult && baseline.score > 0
    ? (((bestResult.score - baseline.score) / baseline.score) * 100).toFixed(1) : '—'
  const totalCost = data?.totalCost || results.reduce((s, r) => s + (r.cost || 0), 0)

  // Chart data
  const chartData = results.map((r, idx) => {
    const bestSoFar = results.slice(0, idx + 1).reduce((b, x) => Math.max(b, x.score), 0)
    return { ...r, bestSoFar }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Changelog slide-over */}
      <ChangelogPanel key={selectedRound?.round} round={selectedRound} criteriaNames={criteriaNames} onClose={() => setSelectedRound(null)} />
      {selectedRound && (
        <div className="fixed inset-0 bg-black/10 z-40" onClick={() => setSelectedRound(null)} />
      )}

      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FlaskConical className="w-7 h-7 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900">Autoresearch</h1>
            <div className="flex items-center ml-4 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('skills')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'skills' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Skills
              </button>
              <button
                onClick={() => setActiveTab('research')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'research' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Microscope className="w-3 h-3" />
                Research
              </button>
            </div>
            {activeTab === 'skills' && results.length > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                {results.length} rounds
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeTab === 'skills' && (
              <>
                <MiniDropdown
                  options={SKILL_OPTIONS(skills)}
                  selected={selectedSkill}
                  onSelect={(s) => { setSelectedSkill(s); setConfig(c => ({ ...c, selectedSkill: s })) }}
                />
                <MiniDropdown
                  label="eval:"
                  options={EVALUATOR_OPTIONS}
                  selected={config.evaluator}
                  onSelect={(v) => setConfig(c => ({ ...c, evaluator: v }))}
                />
                <MiniDropdown
                  label="mut:"
                  options={MUTATOR_OPTIONS}
                  selected={config.mutator}
                  onSelect={(v) => setConfig(c => ({ ...c, mutator: v }))}
                />
                {runnerStatus.running ? (
                  <button onClick={stopRun}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                  >
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button onClick={startRun}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run</span>
                  </button>
                )}
                {lastRefresh && (
                  <span className="text-xs text-gray-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{lastRefresh.toLocaleTimeString()}</span>
                  </span>
                )}
                <button onClick={() => { setShowEvalEditor(!showEvalEditor); if (showConfig) setShowConfig(false) }}
                  className={`p-1.5 rounded-lg transition-colors ${showEvalEditor ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                  title="Edit eval suite"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setShowConfig(!showConfig); if (showEvalEditor) setShowEvalEditor(false) }}
                  className={`p-1.5 rounded-lg transition-colors ${showConfig ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button onClick={() => { setShowKeys(!showKeys); setShowConfig(false); setShowEvalEditor(false) }}
              className={`p-1.5 rounded-lg transition-colors ${showKeys ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              title="API Keys (BYOK)"
            >
              <DollarSign className="w-3.5 h-3.5" />
            </button>
            <a href="https://github.com/ramene/autoresearch" target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 space-y-6">
        {activeTab === 'research' ? (
          <ResearchTab />
        ) : (
        <>
        <p className="text-gray-500 text-sm">
          Autonomous skill improvement via cross-model evaluation
          <span className="text-gray-300 mx-2">·</span>
          <span className="text-xs text-gray-400">refreshes every {config.refreshInterval / 1000}s</span>
          <span className="text-gray-300 mx-2">·</span>
          <span className="text-xs text-gray-400">copies only — originals never modified</span>
        </p>

        <ConfigPanel config={config} onUpdate={setConfig} visible={showConfig} maxScore={results.length > 0 ? results[0].max : null} />

        <EvalEditor skill={selectedSkill} visible={showEvalEditor} />

        <KeySetup visible={showKeys} onClose={() => setShowKeys(false)} />

        {/* Runner Log */}
        {runnerStatus.running && runnerStatus.logTail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-gray-900 rounded-xl p-4 overflow-x-auto"
          >
            <div className="flex items-center space-x-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-medium">Running — PID {runnerStatus.pid}</span>
            </div>
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {runnerStatus.logTail}
            </pre>
          </motion.div>
        )}

        {/* Metric Cards — now 5 with cost */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Current Best"
            value={bestResult ? `${bestResult.score}/${bestResult.max}` : '—'}
            color="text-amber-600" icon={Target}
          />
          <MetricCard label="Baseline"
            value={baseline ? `${baseline.score}/${baseline.max}` : '—'}
            color="text-gray-600" icon={Hash}
          />
          <MetricCard label="Improvement"
            value={improvementPct !== '—' ? `+${improvementPct}%` : '—'}
            color={parseFloat(improvementPct) > 0 ? 'text-green-600' : 'text-gray-600'}
            icon={TrendingUp}
          />
          <MetricCard label="Runs / Kept"
            value={`${totalRounds} / ${keptCount}`}
            color="text-gray-900" icon={Zap}
          />
          <MetricCard label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            color="text-gray-600" icon={DollarSign}
            sub={totalRounds > 0 ? `$${(totalCost / totalRounds).toFixed(2)}/round` : ''}
          />
        </div>

        {/* Score Progress Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Score Progress</h3>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Score per round</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-0.5 bg-green-500" />
                <span>Best so far</span>
              </div>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="round"
                  label={{ value: 'Round #', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 12 }}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                />
                <YAxis domain={[0, 'dataMax + 2']}
                  label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                />
                <Tooltip content={<CustomTooltip />} />
                {baseline && <ReferenceLine y={baseline.score} stroke="#d1d5db" strokeDasharray="6 3" />}
                <Line type="monotone" dataKey="bestSoFar" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="score" stroke="#d97706" strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    const isKept = payload.status === 'kept' || payload.status === 'baseline'
                    return (
                      <circle cx={cx} cy={cy} r={isKept ? 5 : 3}
                        fill={isKept ? '#d97706' : '#9ca3af'}
                        stroke={isKept ? '#fff' : 'none'} strokeWidth={isKept ? 2 : 0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRound(payload)}
                      />
                    )
                  }}
                  activeDot={{ r: 7, fill: '#d97706', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No experiment data yet</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Criteria Heatmap */}
        {criteriaNames.length > 0 && (
          <CriteriaBreakdown rounds={results} criteriaNames={criteriaNames} />
        )}

        {/* Experiment History Table — clickable rows */}
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Experiment History</h3>
              <span className="text-xs text-gray-400">Click a row to view details</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Round</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3">Pass Rate</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Cost</th>
                    <th className="px-6 py-3">Mutation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...results].reverse().map((r, idx) => (
                    <tr key={idx}
                      className="hover:bg-amber-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedRound(r)}
                    >
                      <td className="px-6 py-3 text-sm font-mono text-gray-900">{r.round}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">{r.score}/{r.max}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                r.score / r.max >= 0.95 ? 'bg-green-500' :
                                r.score / r.max >= 0.8 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(r.score / r.max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{((r.score / r.max) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === 'kept' ? 'bg-green-100 text-green-700' :
                          r.status === 'baseline' ? 'bg-blue-100 text-blue-700' :
                          r.status === 'reverted' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {r.status === 'kept' && <CheckCircle className="w-3 h-3" />}
                          {r.status === 'reverted' && <RotateCcw className="w-3 h-3" />}
                          <span className="capitalize">{r.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 font-mono">
                        {r.cost != null ? `$${r.cost.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">{r.mutation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="text-sm text-red-500 text-center bg-red-50 rounded-xl p-4">
            Error loading data: {error}
          </div>
        )}

        <footer className="text-center text-xs text-gray-400 pt-4">
          <p>Autoresearch Dashboard — Adapted from <a href="https://github.com/karpathy/autoresearch" className="underline hover:text-gray-600">karpathy/autoresearch</a></p>
          <p className="mt-1">Cross-model evaluation: Claude (mutate) → Gemini (evaluate) → Claude (synthesize)</p>
        </footer>
        </>
        )}
      </main>
    </div>
  )
}

export default App
