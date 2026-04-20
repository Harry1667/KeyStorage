import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { listKeys, createKey, updateKey, deleteKey, touchKey, exportKeys, importKeys, type KeyRecord } from '../lib/api'
import { encryptKeyData, decryptKeyData, type KeyData } from '../lib/crypto'
import KeyForm from './KeyForm'

interface DecryptedKey {
  id: number
  data: KeyData | null
  record: KeyRecord
}

interface Props {
  cryptoKey: CryptoKey
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export default function KeyList({ cryptoKey, showToast }: Props) {
  const [keys, setKeys] = useState<DecryptedKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingKey, setEditingKey] = useState<DecryptedKey | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'accessed'>('created')
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  const handleKeyboard = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

    if (e.key === 'Escape') {
      if (showForm) { setShowForm(false); setEditingKey(null) }
      else if (isInput) (target as HTMLElement).blur()
      return
    }

    if (isInput) return

    if (e.key === '/' || e.key === 'f') {
      e.preventDefault()
      searchRef.current?.focus()
    } else if (e.key === 'n') {
      e.preventDefault()
      setEditingKey(null)
      setShowForm(true)
    }
  }, [showForm])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [handleKeyboard])

  const loadKeys = async () => {
    try {
      const records = await listKeys()
      const decrypted = await Promise.all(
        records.map(async (r) => ({
          id: r.id,
          data: await decryptKeyData(cryptoKey, r.encrypted_data, r.iv),
          record: r,
        }))
      )
      setKeys(decrypted)
    } catch (err) {
      showToast('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadKeys() }, [])

  const filteredKeys = useMemo(() => {
    let result = keys
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(k => {
        if (!k.data) return false
        return (
          k.data.name.toLowerCase().includes(q) ||
          k.data.category.toLowerCase().includes(q) ||
          k.data.tags.some(t => t.toLowerCase().includes(q)) ||
          k.data.notes.toLowerCase().includes(q)
        )
      })
    }
    if (categoryFilter) {
      result = result.filter(k => k.data?.category === categoryFilter)
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.data?.name ?? '').localeCompare(b.data?.name ?? '')
      }
      if (sortBy === 'accessed') {
        return (b.record.last_accessed_at ?? '').localeCompare(a.record.last_accessed_at ?? '')
      }
      return (b.record.created_at ?? '').localeCompare(a.record.created_at ?? '')
    })
    return result
  }, [keys, search, categoryFilter, sortBy])

  const categories = useMemo(() => {
    const cats = new Set(keys.map(k => k.data?.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [keys])

  const handleSave = async (data: KeyData) => {
    try {
      const encrypted = await encryptKeyData(cryptoKey, data)
      if (editingKey) {
        await updateKey(editingKey.id, encrypted)
        showToast('已更新')
      } else {
        await createKey(encrypted)
        showToast('已新增')
      }
      setShowForm(false)
      setEditingKey(null)
      await loadKeys()
    } catch (err) {
      showToast('儲存失敗', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這筆 Key？')) return
    try {
      await deleteKey(id)
      showToast('已刪除')
      await loadKeys()
    } catch (err) {
      showToast('刪除失敗', 'error')
    }
  }

  const handleCopy = async (k: DecryptedKey) => {
    if (!k.data) return
    try {
      await navigator.clipboard.writeText(k.data.value)
      await touchKey(k.id)
      showToast('已複製到剪貼簿')
    } catch {
      showToast('複製失敗', 'error')
    }
  }

  const toggleReveal = (id: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    touchKey(id)
  }

  const handleExport = async () => {
    try {
      const data = await exportKeys()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `keystorage-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('已匯出備份')
    } catch {
      showToast('匯出失敗', 'error')
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!data.keys || !Array.isArray(data.keys)) {
          showToast('備份格式錯誤', 'error')
          return
        }
        await importKeys({ keys: data.keys })
        // 驗證解密
        const records = await listKeys()
        if (records.length > 0) {
          const test = await decryptKeyData(cryptoKey, records[0].encrypted_data, records[0].iv)
          if (!test) {
            showToast('備份密碼不符，請使用相同主密碼的備份', 'error')
            return
          }
        }
        await loadKeys()
        showToast(`已匯入 ${records.length} 筆`)
      } catch {
        showToast('匯入失敗', 'error')
      }
    }
    input.click()
  }

  const handleExportPlaintext = async () => {
    if (!confirm('匯出明文備份？此檔案包含所有 Key 的明文，請妥善保管。')) return
    const plainKeys = keys
      .filter(k => k.data)
      .map(k => ({
        name: k.data!.name,
        value: k.data!.value,
        category: k.data!.category,
        tags: k.data!.tags,
        notes: k.data!.notes,
      }))
    const blob = new Blob([JSON.stringify(plainKeys, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keystorage-plaintext-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已匯出明文備份')
  }

  if (loading) {
    return <p className="text-center" style={{ color: 'var(--color-text-dim)' }}>載入中...</p>
  }

  return (
    <div>
      {/* 工具列 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn-primary" onClick={() => { setEditingKey(null); setShowForm(true) }}>+ 新增 Key</button>
        <button className="btn-ghost text-xs" onClick={handleExport}>匯出備份</button>
        <button className="btn-ghost text-xs" onClick={handleImport}>匯入備份</button>
        <button className="btn-ghost text-xs" onClick={handleExportPlaintext}>匯出明文</button>
      </div>

      {/* 搜尋與篩選 */}
      <div className="flex gap-2 mb-4">
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋 Key...（按 / 聚焦）"
          className="flex-1"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="w-28"
        >
          <option value="">全部分類</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'name' | 'created' | 'accessed')}
          className="w-28"
        >
          <option value="created">建立時間</option>
          <option value="accessed">最近存取</option>
          <option value="name">名稱</option>
        </select>
      </div>

      {/* 新增/編輯表單 */}
      {showForm && (
        <KeyForm
          initial={editingKey?.data ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingKey(null) }}
        />
      )}

      {/* Key 列表 */}
      {filteredKeys.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-dim)' }}>
          {keys.length === 0 ? '還沒有任何 Key，點「+ 新增 Key」開始' : '沒有符合的結果'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredKeys.map(k => (
            <div
              key={k.id}
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {k.data ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{k.data.name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
                          {k.data.category}
                        </span>
                        {k.data.tags.map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="btn-ghost text-xs px-2" onClick={() => handleCopy(k)} title="複製">📋</button>
                      <button className="btn-ghost text-xs px-2" onClick={() => toggleReveal(k.id)} title="顯示/隱藏">
                        {revealedIds.has(k.id) ? '🙈' : '👁️'}
                      </button>
                      <button className="btn-ghost text-xs px-2" onClick={() => { setEditingKey(k); setShowForm(true) }} title="編輯">✏️</button>
                      <button className="btn-ghost text-xs px-2" onClick={() => handleDelete(k.id)} title="刪除">🗑️</button>
                    </div>
                  </div>
                  {revealedIds.has(k.id) && (
                    <div className="mt-2 p-2 rounded font-mono text-sm break-all" style={{ backgroundColor: 'var(--color-bg)' }}>
                      {k.data.value}
                    </div>
                  )}
                  {k.data.notes && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>{k.data.notes}</div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--color-danger)' }}>⚠️ 無法解密此記錄</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-center text-xs space-y-1" style={{ color: 'var(--color-text-dim)' }}>
        <div>共 {keys.length} 筆 Key</div>
        <div className="opacity-60">
          <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-surface-hover)' }}>/</kbd> 搜尋
          {' '}<kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-surface-hover)' }}>n</kbd> 新增
          {' '}<kbd className="px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-surface-hover)' }}>esc</kbd> 關閉
        </div>
      </div>
    </div>
  )
}
