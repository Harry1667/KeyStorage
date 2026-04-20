import { useState } from 'react'
import { deriveKey, verifyPassword } from '../lib/crypto'
import { verify, setSessionToken, type MetaResponse } from '../lib/api'

interface Props {
  meta: MetaResponse
  onSuccess: (key: CryptoKey) => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export default function LoginPage({ meta, onSuccess, showToast }: Props) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      const key = await deriveKey(password, meta.pbkdf2_salt!)
      const proofHash = await verifyPassword(key, meta.verify_cipher!, meta.verify_iv!)
      if (!proofHash) {
        showToast('密碼錯誤', 'error')
        return
      }
      const { session_token } = await verify(proofHash)
      setSessionToken(session_token)
      onSuccess(key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '驗證失敗'
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div
        className="rounded-lg p-6"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-lg font-semibold mb-4">輸入主密碼</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="主密碼"
            autoFocus
          />
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '驗證中...' : '解鎖'}
          </button>
        </form>
      </div>
    </div>
  )
}
