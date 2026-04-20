import { useState } from 'react'
import { generateSalt, deriveKey, createVerifyCipher } from '../lib/crypto'
import { init } from '../lib/api'

interface Props {
  onComplete: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export default function InitPage({ onComplete, showToast }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      showToast('密碼至少 6 個字元', 'error')
      return
    }
    if (password !== confirm) {
      showToast('兩次密碼不一致', 'error')
      return
    }
    setLoading(true)
    try {
      const salt = await generateSalt()
      const key = await deriveKey(password, salt)
      const { ciphertext, iv, proofHash } = await createVerifyCipher(key)
      await init({
        pbkdf2_salt: salt,
        verify_cipher: ciphertext,
        verify_iv: iv,
        proof_hash: proofHash,
      })
      showToast('主密碼設定完成')
      onComplete()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '設定失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div
        className="rounded-lg p-6 mb-6"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-lg font-semibold mb-4">設定主密碼</h2>
        <div className="text-sm mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          ⚠️ 忘記主密碼 = 資料永久遺失。請務必記住。
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-dim)' }}>主密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-dim)' }}>確認密碼</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="再輸入一次"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '設定中...' : '設定主密碼'}
          </button>
        </form>
      </div>
    </div>
  )
}
