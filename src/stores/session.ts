import { computed, ref } from 'vue'
import type { LoginUser, Role } from '../types/domain'

const storageKey = 'water-current-user'

function loadStoredUser(): LoginUser | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginUser
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}

const currentUser = ref<LoginUser | null>(loadStoredUser())
const isAdmin = computed(() => currentUser.value?.role === 'admin')

export function useSessionStore() {
  function setUser(user: LoginUser) {
    currentUser.value = user
    localStorage.setItem(storageKey, JSON.stringify(user))
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem(storageKey)
  }

  function hasRole(role: Role) {
    return currentUser.value?.role === role
  }

  return {
    currentUser,
    isAdmin,
    setUser,
    logout,
    hasRole,
  }
}
