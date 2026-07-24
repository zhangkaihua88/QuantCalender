<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, ApiError } from '../api'

const submissions = ref<any[]>([])
const error = ref('')
onMounted(async () => { try { submissions.value = (await api<{ submissions: any[] }>('/v1/submissions/mine')).submissions } catch (caught) { error.value = caught instanceof ApiError ? caught.message : '加载失败' } })
const label: Record<string,string> = { pending:'待审核', published:'已发布', rejected:'未通过', cancelled:'已取消' }
</script>

<template>
  <div class="page-head"><div><p class="eyebrow">MY SUBMISSIONS</p><h1>我的投稿</h1><p class="subtitle">这里仅显示当前 WQ_ID 提交的会议和管理员反馈。</p></div><RouterLink class="button" to="/submit">提交新会议</RouterLink></div>
  <div v-if="error" class="error-box">{{ error }}</div>
  <div v-else-if="!submissions.length" class="empty-state">还没有提交过会议。</div>
  <div v-else class="agenda">
    <div v-for="item in submissions" :key="item.id" class="agenda-item">
      <div><span class="status" :class="item.status">{{ label[item.status] || item.status }}</span></div>
      <div><h3>{{ item.title }}</h3><p>{{ item.summary }} · {{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</p><p v-if="item.reviewNote" style="margin-top:8px;color:#8e5c25">管理员反馈：{{ item.reviewNote }}</p></div>
      <RouterLink v-if="item.status === 'published'" class="button secondary small" :to="`/meetings/${item.id}`">查看</RouterLink>
    </div>
  </div>
</template>
