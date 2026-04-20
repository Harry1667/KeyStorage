export default function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  const bg = type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg z-50"
      style={{ backgroundColor: bg }}
    >
      {message}
    </div>
  )
}
