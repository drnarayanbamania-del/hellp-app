// Utility functions for Hello App

/**
 * Format timestamp to Hello App-style time strings
 */
export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const oneDay = 86400000

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getDate() === yesterday.getDate()) return 'Yesterday'

  if (diff < 7 * oneDay) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Format full date for day dividers
 */
export function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const oneDay = 86400000

  if (diff < oneDay && date.getDate() === now.getDate()) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getDate() === yesterday.getDate()) return 'Yesterday'

  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Get initials from a name
 */
export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Generate a color from a string (consistent avatar background)
 */
const COLORS = [
  '#00a884', '#308080', '#7c5cbf', '#d147a3',
  '#e84646', '#e8a046', '#3d8f5e', '#1a7fa1',
]
export function stringToColor(str) {
  if (!str) return COLORS[0]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

/**
 * Show a toast notification
 */
export function showToast(msg, type = 'default', duration = 3000) {
  let container = document.querySelector('.toast-container')
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = msg
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

/**
 * Auto-resize a textarea
 */
export function autoResize(el) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(text))
  return div.innerHTML
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
