<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Calendar, ChevronLeft, ChevronRight, List, Search } from 'lucide-vue-next'
import type { MeetingOccurrence } from '@wq-calendar/shared'
import { api, ApiError } from '../api'

const occurrences = ref<MeetingOccurrence[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const category = ref('')
const meetingLanguage = ref('')
const locationType = ref('')
const view = ref<'agenda' | 'month'>('agenda')
const monthCursor = ref(new Date())

const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short' })
const timeFormatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
    const data = await api<{ occurrences: MeetingOccurrence[] }>(`/v1/meetings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    occurrences.value = data.occurrences
  } catch (caught) { error.value = caught instanceof ApiError ? caught.message : '加载会议失败' }
  finally { loading.value = false }
}

const filtered = computed(() => occurrences.value.filter((item) => {
  const text = `${item.title} ${item.summary} ${item.organizer} ${item.speaker}`.toLowerCase()
  return (!query.value || text.includes(query.value.toLowerCase()))
    && (!category.value || item.category === category.value)
    && (!meetingLanguage.value || item.meetingLanguage === meetingLanguage.value)
    && (!locationType.value || item.locationType === locationType.value)
}))
const upcoming = computed(() => filtered.value.find((item) => item.status === 'published' && new Date(item.endUtc).getTime() >= Date.now()))
const agendaItems = computed(() => filtered.value.filter((item) => item !== upcoming.value))
const categories = computed(() => [...new Set(occurrences.value.map((item) => item.category))].sort())

function shanghaiParts(date: string) {
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(date))
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { month: get('month'), day: get('day'), weekday: get('weekday') }
}

function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function occurrenceDayKey(value: string) {
  const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  return formatted
}

const monthDays = computed(() => {
  const year = monthCursor.value.getFullYear()
  const month = monthCursor.value.getMonth()
  const first = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = dayKey(date)
    return { date, key, current: date.getMonth() === month, events: filtered.value.filter((item) => occurrenceDayKey(item.startUtc) === key) }
  })
})

function shiftMonth(delta: number) { monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + delta, 1) }
function detailLink(item: MeetingOccurrence) {
  return {
    path: `/meetings/${item.eventId}`,
    query: { occurrence: item.occurrenceKey, start: item.startUtc, end: item.endUtc, status: item.status }
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><p class="eyebrow">MEMBER CALENDAR</p><h1>会议安排</h1><p class="subtitle">所有时间均按北京时间显示。订阅个人日历后，新会议、改期和取消会随客户端刷新同步。</p></div>
      <div class="segmented" aria-label="切换日历视图">
        <button :class="{ active: view === 'agenda' }" @click="view = 'agenda'"><List :size="16" /> 议程</button>
        <button :class="{ active: view === 'month' }" @click="view = 'month'"><Calendar :size="16" /> 月历</button>
      </div>
    </div>

    <div class="filters">
      <label style="position:relative"><Search :size="17" style="position:absolute;left:13px;top:13px;color:#839096" /><input v-model="query" style="width:100%;padding-left:39px" placeholder="搜索会议、主办方或讲者" /></label>
      <select v-model="category"><option value="">全部类别</option><option v-for="item in categories" :key="item">{{ item }}</option></select>
      <select v-model="meetingLanguage"><option value="">全部语言</option><option value="zh">中文</option><option value="en">英文</option><option value="bilingual">中英双语</option><option value="other">其他</option></select>
      <select v-model="locationType"><option value="">全部形式</option><option value="online">线上</option><option value="offline">线下</option><option value="hybrid">线上 + 线下</option></select>
      <button class="button secondary small" @click="query='';category='';meetingLanguage='';locationType=''">清除</button>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div v-else-if="loading" class="empty-state">正在整理未来 180 天的会议…</div>
    <div v-else-if="filtered.length === 0" class="empty-state"><div><h2>暂时没有匹配的会议</h2><p>可以调整筛选条件，或提交一场新会议等待管理员审批。</p></div></div>

    <template v-else-if="view === 'agenda'">
      <RouterLink v-if="upcoming" :to="detailLink(upcoming)" class="hero-meeting" style="text-decoration:none">
        <div class="date-tile"><strong>{{ shanghaiParts(upcoming.startUtc).day }}</strong><span>{{ shanghaiParts(upcoming.startUtc).month }}月 · {{ shanghaiParts(upcoming.startUtc).weekday }}</span></div>
        <div><p class="eyebrow" style="color:#9ed3ce">NEXT MEETING · {{ timeFormatter.format(new Date(upcoming.startUtc)) }}</p><h2>{{ upcoming.title }}</h2><p>{{ upcoming.summary }} · {{ upcoming.organizer }}</p></div>
        <span class="button">查看并注册</span>
      </RouterLink>
      <div class="section-title"><h2>后续议程</h2><span class="muted">{{ agendaItems.length }} 场</span></div>
      <div class="agenda">
        <RouterLink v-for="item in agendaItems" :key="`${item.eventId}-${item.occurrenceKey}`" :to="detailLink(item)" class="agenda-item" :class="{ cancelled: item.status === 'cancelled' }">
          <div class="agenda-time">{{ timeFormatter.format(new Date(item.startUtc)) }}<span>{{ formatter.format(new Date(item.startUtc)) }}</span></div>
          <div><h3>{{ item.title }}</h3><p>{{ item.summary }} · {{ item.organizer }}</p></div>
          <div class="agenda-meta"><span class="tag">{{ item.category }}</span><span>{{ item.locationType === 'online' ? '线上' : item.locationType === 'offline' ? '线下' : '混合' }}</span><span v-if="item.status === 'cancelled'" class="status cancelled">已取消</span></div>
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <div class="section-title">
        <button class="icon-button" @click="shiftMonth(-1)"><ChevronLeft :size="18" /></button>
        <h2>{{ monthCursor.getFullYear() }} 年 {{ monthCursor.getMonth() + 1 }} 月</h2>
        <button class="icon-button" @click="shiftMonth(1)"><ChevronRight :size="18" /></button>
      </div>
      <div class="month-calendar">
        <div class="month-head"><span v-for="day in ['日','一','二','三','四','五','六']" :key="day">周{{ day }}</span></div>
        <div class="month-grid">
          <div v-for="day in monthDays" :key="day.key" class="month-day" :class="{ outside: !day.current }">
            <span class="day-number" :class="{ today: day.key === dayKey(new Date()) }">{{ day.date.getDate() }}</span>
            <RouterLink v-for="item in day.events.slice(0,3)" :key="item.occurrenceKey" :to="detailLink(item)" class="calendar-chip">{{ timeFormatter.format(new Date(item.startUtc)) }} {{ item.title }}</RouterLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
