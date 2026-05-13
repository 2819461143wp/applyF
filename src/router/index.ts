import { createRouter, createWebHistory } from 'vue-router'
import WorkspaceLayout from '../layouts/WorkspaceLayout.vue'
import { useSessionStore } from '../stores/session'
import type { Role } from '../types/domain'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: () => {
        const session = useSessionStore()
        if (!session.currentUser.value) return '/login'
        return session.currentUser.value.role === 'admin' ? '/admin/review' : '/applicant/apply'
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/applicant',
      component: WorkspaceLayout,
      meta: { requiresAuth: true, role: 'user' satisfies Role },
      children: [
        { path: '', redirect: '/applicant/apply' },
        { path: 'apply', name: 'applicant-apply', component: () => import('../views/applicant/ApplyView.vue') },
        { path: 'result', name: 'applicant-result', component: () => import('../views/applicant/ResultView.vue') },
        { path: 'applications', name: 'applicant-applications', component: () => import('../views/shared/ApplicationsView.vue') },
      ],
    },
    {
      path: '/admin',
      component: WorkspaceLayout,
      meta: { requiresAuth: true, role: 'admin' satisfies Role },
      children: [
        { path: '', redirect: '/admin/review' },
        { path: 'review', name: 'admin-review', component: () => import('../views/shared/ApplicationsView.vue') },
        { path: 'knowledge', name: 'admin-knowledge', component: () => import('../views/admin/KnowledgeBaseView.vue') },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const session = useSessionStore()
  const requiredRole = to.matched.find((record) => record.meta.role)?.meta.role as Role | undefined
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (requiresAuth && !session.currentUser.value) {
    return '/login'
  }
  if (requiredRole && !session.hasRole(requiredRole)) {
    return session.currentUser.value?.role === 'admin' ? '/admin/review' : '/applicant/apply'
  }
  if (to.path === '/login' && session.currentUser.value) {
    return session.currentUser.value.role === 'admin' ? '/admin/review' : '/applicant/apply'
  }
  return true
})

export default router
