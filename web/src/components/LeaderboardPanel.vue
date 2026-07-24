<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Award, Trophy } from 'lucide-vue-next'
import type { LeaderboardEntry } from '@wq-calendar/shared'
import { api, ApiError } from '../api'

type LeaderboardSummary = { contributorCount: number; submissionCount: number; approvedCount: number; approvalRate: number }
type Pagination = { page: number; pageSize: number; total: number; totalPages: number }

const entries = ref<LeaderboardEntry[]>([])
const summary = ref<LeaderboardSummary>({ contributorCount: 0, submissionCount: 0, approvedCount: 0, approvalRate: 0 })
const pagination = ref<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 1 })
const pageSize = ref(50)
const loading = ref(true)
const error = ref('')
const podium = computed(() => pagination.value.page === 1 ? entries.value.slice(0, 3) : [])

onMounted(() => load(1))

async function load(page = pagination.value.page) {
  loading.value = true
  error.value = ''
  try {
    const data = await api<{ summary: LeaderboardSummary; pagination: Pagination; entries: LeaderboardEntry[] }>(`/v1/leaderboard?page=${page}&pageSize=${pageSize.value}`)
    summary.value = data.summary
    pagination.value = data.pagination
    entries.value = data.entries
  } catch (caught) { error.value = caught instanceof ApiError ? caught.message : '排行榜加载失败' }
  finally { loading.value = false }
}
</script>

<template>
  <div v-if="error" class="error-box">{{ error }}</div>
  <div v-else-if="loading" class="empty-state">正在统计成员投稿…</div>
  <div v-else class="stack">
    <div class="metric-grid leaderboard-metrics">
      <div class="card metric-card"><span>投稿成员</span><strong>{{ summary.contributorCount }}</strong></div>
      <div class="card metric-card"><span>投稿总数</span><strong>{{ summary.submissionCount }}</strong></div>
      <div class="card metric-card"><span>通过总数</span><strong>{{ summary.approvedCount }}</strong></div>
      <div class="card metric-card"><span>整体通过率</span><strong>{{ summary.approvalRate }}%</strong></div>
    </div>

    <div v-if="podium.length" class="leaderboard-podium">
      <article v-for="entry in podium" :key="entry.memberId" class="card podium-card" :class="[`place-${entry.rank}`, { 'is-current': entry.isCurrentUser }]">
        <div class="podium-rank"><Trophy v-if="entry.rank === 1" :size="24" /><Award v-else :size="22" />第 {{ entry.rank }} 名</div>
        <strong>{{ entry.wqId }}<span v-if="entry.isCurrentUser" class="tag">我</span></strong>
        <span>{{ entry.country }} · 投稿 {{ entry.submissionCount }} 次</span>
        <b>通过 {{ entry.approvedCount }} 次</b>
      </article>
    </div>

    <div class="card card-body">
      <div class="section-title leaderboard-head">
        <div><h2>投稿排行榜</h2><p class="fine-print">按通过次数排序，其次按投稿次数排序；会议通过后即计入，之后取消仍保留通过记录。</p></div>
        <select v-model.number="pageSize" aria-label="排行榜每页数量" @change="load(1)"><option :value="25">每页 25 名</option><option :value="50">每页 50 名</option><option :value="100">每页 100 名</option></select>
      </div>
      <table class="data-table leaderboard-table"><thead><tr><th>排名</th><th>WQ_ID</th><th>地区</th><th>投稿次数</th><th>通过次数</th><th>通过率</th></tr></thead><tbody><tr v-for="entry in entries" :key="entry.memberId" :class="{ 'current-user-row': entry.isCurrentUser }"><td><strong class="rank-number">{{ entry.rank }}</strong></td><td><strong>{{ entry.wqId }}</strong><span v-if="entry.isCurrentUser" class="tag">我</span></td><td>{{ entry.country }}</td><td>{{ entry.submissionCount }}</td><td><strong>{{ entry.approvedCount }}</strong></td><td>{{ entry.approvalRate }}%</td></tr></tbody></table>
      <div v-if="!entries.length" class="empty-state">目前还没有成员投稿。</div>
      <div v-else class="pagination-bar"><span class="fine-print">第 {{ (pagination.page - 1) * pagination.pageSize + 1 }}–{{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 名，共 {{ pagination.total }} 名</span><div class="inline"><button class="button secondary small" :disabled="pagination.page <= 1 || loading" @click="load(pagination.page - 1)">上一页</button><button class="button secondary small" :disabled="pagination.page >= pagination.totalPages || loading" @click="load(pagination.page + 1)">下一页</button></div></div>
    </div>
  </div>
</template>
