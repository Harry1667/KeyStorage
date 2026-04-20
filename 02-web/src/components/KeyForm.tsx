import { useState } from 'react'
import type { KeyData } from '../lib/crypto'

const CATEGORIES = ['API', 'SSH', 'Database', 'Cloud', 'Other']

interface Props {
  initial?: KeyData
  onSave: (data: KeyData) => void
  onCancel: () => void
}

export default function KeyForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'API')
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !value.trim()) return
    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    onSave({ name: name.trim(), value: value.trim(), category, tags, notes: notes.trim() })
  }

  return (
    <div
      className="rounded-lg p-6 mb-4"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <h3 className="text-base font-semibold mb-4">{initial ? '編輯 Key' : '新增 Key'}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>名稱</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="例如 OpenAI API Key" autoFocus />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>Key 值</label>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="sk-..."
            rows={2}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>分類</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>標籤（逗號分隔）</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="dev, prod" />
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-dim)' }}>筆記</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="選填" rows={2} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary flex-1">{initial ? '更新' : '新增'}</button>
          <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
        </div>
      </form>
    </div>
  )
}
