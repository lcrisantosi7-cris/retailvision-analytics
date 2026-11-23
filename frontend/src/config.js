const configuredApi = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const API_BASE_URL = configuredApi || 'http://localhost:8000'

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws')
