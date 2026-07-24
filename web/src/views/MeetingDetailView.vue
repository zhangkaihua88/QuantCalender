<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CalendarPlus, ExternalLink, MapPin, UserRound } from 'lucide-vue-next'
import { API_BASE_URL, api, ApiError } from '../api'

const route = useRoute()
const meeting = ref<any>(null)
const error = ref('')
const alarm = ref(30)

onMounted(async () => {
  try { meeting.value = (await api<{ meeting: any }>(`/v1/meetings/${route.params.id}`)).meeting }
  catch (caught) { error.value = caught instanceof ApiError ? caught.message : '会议加载失败' }
})

const occurrenceStart = computed(() => typeof route.query.start === 'string' ? route.query.start : meeting.value?.startUtc)
const occurrenceEnd = computed(() => typeof route.query.end === 'string' ? route.query.end : meeting.value?.endUtc)
const occurrenceStatus = computed(() => typeof route.query.status === 'string' ? route.query.status : meeting.value?.status)
const dateText = computed(() => occurrenceStart.value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'short', hour12: false }).format(new Date(occurrenceStart.value)) : '')
const endText = computed(() => occurrenceEnd.value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', timeStyle: 'short', hour12: false }).format(new Date(occurrenceEnd.value)) : '')
const deadlineText = computed(() => meeting.value?.registrationDeadlineUtc ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(meeting.value.registrationDeadlineUtc)) : '')
const calendarUrl = computed(() => meeting.value && occurrenceStart.value && occurrenceEnd.value ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meeting.value.title)}&dates=${compact(occurrenceStart.value)}/${compact(occurrenceEnd.value)}&details=${encodeURIComponent(`${meeting.value.summary}\n\n${meeting.value.registrationUrl}`)}&location=${encodeURIComponent(meeting.value.locationText)}` : '#')
function compact(value: string) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') }
</script>

<template>
  <div v-if="error" class="error-box">{{ error }}</div>
  <div v-else-if="!meeting" class="empty-state">正在加载会议详情…</div>
  <div v-else>
    <div class="page-head"><div><p class="eyebrow">MEETING DETAILS</p><h1>{{ meeting.title }}</h1><p class="subtitle">{{ meeting.summary }}</p></div><span class="status" :class="occurrenceStatus">{{ occurrenceStatus === 'cancelled' ? '该场次已取消' : '已发布' }}</span></div>
    <div class="detail-layout">
      <section class="card card-body">
        <div class="inline"><span class="tag">{{ meeting.category }}</span><span class="tag">{{ meeting.meetingLanguage === 'zh' ? '中文' : meeting.meetingLanguage === 'en' ? '英文' : '中英双语' }}</span></div>
        <div class="divider"></div>
        <h2>会议说明</h2><p class="detail-copy">{{ meeting.description || meeting.summary }}</p>
        <div class="divider"></div>
        <div class="inline"><a class="button" :class="{ disabled: occurrenceStatus === 'cancelled' }" :href="occurrenceStatus === 'cancelled' ? undefined : meeting.registrationUrl" target="_blank" rel="noopener noreferrer"><ExternalLink :size="17" />前往注册</a><a class="button secondary" :href="calendarUrl" target="_blank" rel="noopener noreferrer"><CalendarPlus :size="17" />添加到 Google</a></div>
      </section>
      <aside class="stack">
        <section class="card card-body">
          <h2>时间与地点</h2>
          <dl class="meta-list">
            <div class="meta-row"><dt>北京时间</dt><dd>{{ dateText }} – {{ endText }}</dd></div>
            <div class="meta-row"><dt>原始时区</dt><dd>{{ meeting.sourceTimezone }}</dd></div>
            <div v-if="deadlineText" class="meta-row"><dt>报名截止</dt><dd>{{ deadlineText }}（北京时间）</dd></div>
            <div class="meta-row"><dt><UserRound :size="16" /> 主办方</dt><dd>{{ meeting.organizer }}<span v-if="meeting.speaker"><br />讲者：{{ meeting.speaker }}</span></dd></div>
            <div class="meta-row"><dt><MapPin :size="16" /> 地点</dt><dd>{{ meeting.locationText }}</dd></div>
          </dl>
        </section>
        <section class="card card-body">
          <h2>下载到个人日历</h2><p class="fine-print">下载是单次快照。持续同步请在“设置”页面生成私密订阅地址。</p>
          <div class="field"><label for="alarm">提前提醒</label><select id="alarm" v-model="alarm"><option :value="0">不提醒</option><option :value="10">10 分钟</option><option :value="30">30 分钟</option><option :value="60">1 小时</option><option :value="1440">1 天</option></select></div>
          <a class="button secondary" style="margin-top:12px;width:100%" :href="`${API_BASE_URL}/v1/meetings/${meeting.id}.ics?alarm=${alarm}`"><CalendarPlus :size="17" />下载 .ics</a>
        </section>
      </aside>
    </div>
  </div>
</template>
