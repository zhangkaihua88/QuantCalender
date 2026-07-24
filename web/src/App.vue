<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, CircleHelp, ClipboardPlus, Github, LogOut, Settings, ShieldCheck } from 'lucide-vue-next'
import { logout, session } from './state'

const route = useRoute()
const router = useRouter()
const isLogin = computed(() => route.path === '/login')

async function signOut() {
  await logout()
  await router.push('/login')
}
</script>

<template>
  <div class="site-shell" :class="{ 'login-shell': isLogin }">
    <header v-if="!isLogin" class="topbar">
      <RouterLink to="/" class="brand" aria-label="返回会议日历首页">
        <span class="brand-mark">WQ</span>
        <span>
          <strong>Meeting Calendar</strong>
          <small>非官方成员工具</small>
        </span>
      </RouterLink>
      <nav class="main-nav" aria-label="主导航">
        <RouterLink to="/"><CalendarDays :size="18" />日历</RouterLink>
        <RouterLink v-if="session.user?.role === 'member'" to="/submit"><ClipboardPlus :size="18" />投稿</RouterLink>
        <RouterLink v-if="session.user?.role === 'member'" to="/calendar-settings"><Settings :size="18" />提醒</RouterLink>
        <RouterLink v-if="session.user?.role === 'admin'" to="/admin"><ShieldCheck :size="18" />管理</RouterLink>
        <RouterLink to="/about"><CircleHelp :size="18" />说明</RouterLink>
      </nav>
      <div class="user-actions">
        <a class="github-link" href="https://github.com/zhangkaihua88/QuantCalender" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看 QuantCalender 项目">
          <Github :size="18" /><span>GitHub</span>
        </a>
        <span class="member-pill">{{ session.user?.wqIdHint }}</span>
        <button class="icon-button" type="button" aria-label="退出登录" @click="signOut"><LogOut :size="18" /></button>
      </div>
    </header>

    <main :class="isLogin ? '' : 'page-container'">
      <RouterView />
    </main>

    <footer v-if="!isLogin" class="site-footer">
      <span>WQ Meeting Calendar · 北京时间</span>
      <span>请勿在会议信息中保存密码或个人专属入会链接</span>
    </footer>
  </div>
</template>
