<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { MeetingInput } from '@wq-calendar/shared'

type RecurrenceValue = { kind: 'none' | 'weekly' | 'biweekly' | 'monthly'; untilLocal: string | null }
type FormValue = MeetingInput & { durationMinutes: number; recurrence: RecurrenceValue }

const props = withDefaults(defineProps<{
  initial?: Partial<MeetingInput>
  submitLabel?: string
  busy?: boolean
}>(), { submitLabel: '提交审核', busy: false })

const emit = defineEmits<{ submit: [meeting: MeetingInput] }>()

function localDefault(hoursAhead = 24) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  const shanghai = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const offset = shanghai.getTimezoneOffset()
  return new Date(shanghai.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function defaults(): FormValue {
  return {
    title: '', summary: '', description: '', organizer: 'WQ', speaker: '', category: '培训',
    meetingLanguage: 'zh', locationType: 'online', locationText: '线上会议', registrationUrl: '',
    registrationDeadlineUtc: null, sourceTimezone: 'Asia/Shanghai', startLocal: localDefault(24),
    endLocal: localDefault(25), durationMinutes: 60, recurrence: { kind: 'none', untilLocal: null }
  }
}

function withSeconds(value: string | null) {
  if (!value) return null
  return value.length === 16 ? `${value}:00` : value
}

function durationBetween(start?: string, end?: string) {
  if (!start || !end) return 60
  const minutes = Math.round((Date.parse(`${withSeconds(end)}Z`) - Date.parse(`${withSeconds(start)}Z`)) / 60000)
  return minutes > 0 ? minutes : 60
}

function formValue(initial?: Partial<MeetingInput>): FormValue {
  const base = defaults()
  return {
    ...base,
    ...initial,
    durationMinutes: durationBetween(initial?.startLocal, initial?.endLocal),
    recurrence: { ...base.recurrence, ...initial?.recurrence }
  }
}

const form = reactive<FormValue>(formValue(props.initial))
const showUntil = computed(() => form.recurrence.kind !== 'none')

watch(() => props.initial, (value) => {
  Object.assign(form, formValue(value))
}, { deep: true })

function addMinutes(value: string, minutes: number) {
  const date = new Date(`${withSeconds(value)}Z`)
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  return date.toISOString().slice(0, 19)
}

function submit() {
  const { durationMinutes, ...meeting } = form
  const startLocal = withSeconds(meeting.startLocal)!
  emit('submit', {
    ...meeting,
    summary: meeting.summary.trim() || meeting.title.trim(),
    description: meeting.description || '',
    organizer: meeting.organizer.trim() || 'WQ',
    speaker: meeting.speaker || '',
    locationType: 'online',
    locationText: '线上会议',
    registrationDeadlineUtc: null,
    sourceTimezone: 'Asia/Shanghai',
    startLocal,
    endLocal: addMinutes(startLocal, durationMinutes),
    recurrence: { ...meeting.recurrence, untilLocal: showUntil.value ? withSeconds(meeting.recurrence.untilLocal) : null }
  })
}
</script>

<template>
  <form class="stack" @submit.prevent="submit">
    <div class="form-grid">
      <div class="field wide">
        <label for="meeting-title">会议名称 *</label>
        <input id="meeting-title" v-model="form.title" required maxlength="120" placeholder="例如：亚洲区顾问周会" />
      </div>
      <div class="field">
        <label for="category">类别 *</label>
        <select id="category" v-model="form.category">
          <option>培训</option><option>顾问周会</option><option>研究分享</option><option>平台更新</option><option>答疑</option><option>其他</option>
        </select>
      </div>
      <div class="field">
        <label for="language">会议语言</label>
        <select id="language" v-model="form.meetingLanguage">
          <option value="zh">中文</option><option value="en">英文</option><option value="bilingual">中英双语</option><option value="other">其他</option>
        </select>
      </div>
      <div class="field wide">
        <label for="registration-url">注册链接 *</label>
        <input id="registration-url" v-model="form.registrationUrl" required type="url" inputmode="url" placeholder="https://..." />
        <small>仅接受 HTTPS 注册页；不要填写含密码、账号或个人令牌的直达链接。</small>
      </div>
      <div class="field">
        <label for="start">开始时间 * <span class="tag">北京时间</span></label>
        <input id="start" v-model="form.startLocal" required type="datetime-local" />
      </div>
      <div class="field">
        <label for="duration">持续时长</label>
        <select id="duration" v-model="form.durationMinutes">
          <option :value="30">30 分钟</option>
          <option :value="60">1 小时</option>
          <option :value="90">1.5 小时</option>
          <option :value="120">2 小时</option>
          <option :value="180">3 小时</option>
        </select>
      </div>
      <div class="field">
        <label for="recurrence">重复方式</label>
        <select id="recurrence" v-model="form.recurrence.kind">
          <option value="none">不重复</option><option value="weekly">每周</option><option value="biweekly">每两周</option><option value="monthly">每月同日</option>
        </select>
      </div>
      <div v-if="showUntil" class="field">
        <label for="recurrence-until">重复至 * <span class="tag">北京时间</span></label>
        <input id="recurrence-until" v-model="form.recurrence.untilLocal" required type="datetime-local" />
        <small>最长 12 个月；月度重复遇到不存在的日期时跳过该月。</small>
      </div>
    </div>
    <div class="inline">
      <button class="button" type="submit" :disabled="busy">{{ busy ? '正在保存…' : submitLabel }}</button>
      <span class="fine-print">开始与重复时间均按北京时间；结束时间根据持续时长自动计算。</span>
    </div>
  </form>
</template>
