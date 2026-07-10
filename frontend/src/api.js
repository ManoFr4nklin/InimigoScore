export const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000')

const TOKEN_KEY = 'inis_token'

export const getToken   = () => localStorage.getItem(TOKEN_KEY)
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export function apiFetch(path, options = {}) {
  const { headers, ...rest } = options
  return fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken() || ''}`,
      ...headers
    }
  }).then(res => {
    if (res.status === 401) {
      clearToken()
      window.location.reload()
    }
    return res
  })
}
