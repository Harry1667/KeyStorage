import { useState, useEffect, useCallback, useRef } from 'react'
import { getMeta, setSessionToken, type MetaResponse } from './lib/api'
import InitPage from './components/InitPage'
import LoginPage from './components/LoginPage'
import KeyList from './components/KeyList'
import Toast from './components/Toast'

type Page = 'loading' | 'init' | 'login' | 'keys'

export default function App() {
  const [page, setPage] = useState<Page>('loading')
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LOCK_TIMEOUT = 15 * 60 * 1000

  const lock = useCallback(() => {
    setCryptoKey(null)
    setSessionToken(null)
    setPage('login')
  }, [])

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    if (cryptoKey) {
      lockTimerRef.current = setTimeout(lock, LOCK_TIMEOUT)
    }
  }, [cryptoKey, lock, LOCK_TIMEOUT])

  useEffect(() => {
    if (!cryptoKey) return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetLockTimer))
    resetLockTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetLockTimer))
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [cryptoKey, resetLockTimer])

  useEffect(() => {
    getMeta()
      .then(m => {
        setMeta(m)
        setPage(m.initialized ? 'login' : 'init')
      })
      .catch(() => setPage('init'))
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleInitComplete = () => {
    getMeta().then(m => {
      setMeta(m)
      setPage('login')
    })
  }

  const handleLoginSuccess = (key: CryptoKey) => {
    setCryptoKey(key)
    setPage('keys')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8" onClick={resetLockTimer}>
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">🔐 KeyStorage</h1>
        {page === 'keys' && (
          <button className="btn-ghost text-xs mt-2" onClick={lock}>鎖定</button>
        )}
      </header>

      {page === 'loading' && (
        <p className="text-center" style={{ color: 'var(--color-text-dim)' }}>載入中...</p>
      )}
      {page === 'init' && <InitPage onComplete={handleInitComplete} showToast={showToast} />}
      {page === 'login' && meta && <LoginPage meta={meta} onSuccess={handleLoginSuccess} showToast={showToast} />}
      {page === 'keys' && cryptoKey && <KeyList cryptoKey={cryptoKey} showToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
