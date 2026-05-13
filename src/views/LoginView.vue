<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginRequest } from '../services/api'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const session = useSessionStore()
const loading = ref(false)
const loginError = ref('')
const loginForm = reactive({
  username: 'user',
  password: 'user123',
})

async function login() {
  loginError.value = ''
  loading.value = true
  try {
    const user = await loginRequest(loginForm.username, loginForm.password)
    session.setUser(user)
    await router.push(user.role === 'admin' ? '/admin/review' : '/applicant/apply')
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '账号或密码错误。演示账号：user/user123，admin/admin123。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="shell">
    <section class="login-screen">
      <div class="login-card">
        <p class="eyebrow">Water Approval Demo</p>
        <h1>涉水审批智能审核系统</h1>
        <p class="hero-copy">请先登录，系统会根据账号自动进入申请人界面或管理员界面。</p>
        <form class="login-form" @submit.prevent="login">
          <label>
            账号
            <input v-model="loginForm.username" autocomplete="username" />
          </label>
          <label>
            密码
            <input v-model="loginForm.password" type="password" autocomplete="current-password" />
          </label>
          <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录系统' }}</button>
          <p v-if="loginError" class="error-line">{{ loginError }}</p>
        </form>
        <div class="demo-accounts">
          <button type="button" class="minor" @click="loginForm.username = 'user'; loginForm.password = 'user123'">申请人 user/user123</button>
          <button type="button" class="minor" @click="loginForm.username = 'admin'; loginForm.password = 'admin123'">管理员 admin/admin123</button>
        </div>
      </div>
    </section>
  </main>
</template>
