<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const session = useSessionStore()
const currentUser = session.currentUser
const isAdmin = session.isAdmin
const title = computed(() => (isAdmin.value ? '管理员工作台' : '申请人工作台'))
const subtitle = computed(() =>
  isAdmin.value ? '可处理人工审核、维护 RAG 知识库并查看向量分布。' : '可上传材料、OCR 回填表单并提交 AI 初审。',
)

async function logout() {
  session.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">{{ isAdmin ? 'Admin Console' : 'Applicant Console' }}</p>
        <h1>{{ title }}</h1>
        <p class="hero-copy">当前账号：{{ currentUser?.displayName }}。{{ subtitle }}</p>
      </div>
      <div class="top-actions">
        <nav v-if="!isAdmin">
          <RouterLink to="/applicant/apply">新建申请</RouterLink>
          <RouterLink to="/applicant/result">初审结果</RouterLink>
          <RouterLink to="/applicant/applications">我的申请</RouterLink>
        </nav>
        <nav v-else>
          <RouterLink to="/admin/review">人工审核</RouterLink>
          <RouterLink to="/admin/knowledge">知识库管理</RouterLink>
        </nav>
        <button class="minor" type="button" @click="logout">退出登录</button>
      </div>
    </header>
    <RouterView />
  </main>
</template>
