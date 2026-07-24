<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { MeetingInput } from '@wq-calendar/shared'

type FormValue = MeetingInput & { recurrence: { kind: 'none' | 'weekly' | 'biweekly' | 'monthly'; untilLocal: string | null } }

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
    title: '', summary: '', description: '', organizer: '', speaker: '', category: '培训',
    meetingLanguage: 'zh', locationType: 'online', locationText: '线上会议', registrationUrl: '',
    registrationDeadlineUtc: null, sourceTimezone: 'Asia/Shanghai', startLocal: localDefault(24),
    endLocal: localDefault(25), recurrence: { kind: 'none', untilLocal: null }
  }
}

const form = reactive<FormValue>({ ...defaults(), ...props.initial, recurrence: { ...defaults().recurrence, ...props.initial?.recurrence } })
const showUntil = computed(() => form.recurrence.kind !== 'none')

watch(() => props.initial, (value) => {
  if (!value) return
  Object.assign(form, value, { recurrence: { ...defaults().recurrence, ...value.recurrence } })
}, { deep: true })

function withSeconds(value: string | null) {
  if (!value) return null
  return value.length === 16 ? `${value}:00` : value
}

function beijingLocalToUtc(value: string | null) {
  const local = withSeconds(value)
  return local ? new Date(`${local}+08:00`).toISOString() : null
}

function submit() {
  emit('submit', {
    ...form,
    registrationDeadlineUtc: beijingLocalToUtc(form.registrationDeadlineUtc),
    startLocal: withSeconds(form.startLocal)!,
    endLocal: withSeconds(form.endLocal)!,
    recurrence: { ...form.recurrence, untilLocal: showUntil.value ? withSeconds(form.recurrence.untilLocal) : null }
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
      <div class="field wide">
        <label for="meeting-summary">一句话简介 *</label>
        <input id="meeting-summary" v-model="form.summary" required maxlength="240" placeholder="说明这场会议讨论什么、适合谁参加" />
      </div>
      <div class="field wide">
        <label for="meeting-description">详细说明</label>
        <textarea id="meeting-description" v-model="form.description" maxlength="4000" placeholder="议程、准备事项或补充说明。请勿填写会议密码和个人专属链接。" />
      </div>
      <div class="field">
        <label for="organizer">主办方 *</label>
        <input id="organizer" v-model="form.organizer" required maxlength="120" />
      </div>
      <div class="field">
        <label for="speaker">讲者</label>
        <input id="speaker" v-model="form.speaker" maxlength="120" />
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
      <div class="field">
        <label for="location-type">形式</label>
        <select id="location-type" v-model="form.locationType">
          <option value="online">线上</option><option value="offline">线下</option><option value="hybrid">线上 + 线下</option>
        </select>
      </div>
      <div class="field">
        <label for="location-text">平台或地点 *</label>
        <input id="location-text" v-model="form.locationText" required maxlength="160" placeholder="例如：Zoom 注册后获取链接" />
      </div>
      <div class="field wide">
        <label for="registration-url">注册链接 *</label>
        <input id="registration-url" v-model="form.registrationUrl" required type="url" inputmode="url" placeholder="https://..." />
        <small>仅接受 HTTPS 注册页；不要填写含密码、账号或个人令牌的直达链接。</small>
      </div>
      <div class="field">
        <label for="timezone">会议原始时区 *</label>
        <input id="timezone" v-model="form.sourceTimezone" required list="timezones" />
        <datalist id="timezones">
          <option value="Asia/Shanghai" /><option value="Asia/Hong_Kong" /><option value="America/New_York" />
          <option value="Europe/London" /><option value="Asia/Singapore" /><option value="Asia/Kolkata" />
        </datalist>
      </div>
      <div class="field">
        <label for="deadline">报名截止（北京时间，可选）</label>
        <input id="deadline" v-model="form.registrationDeadlineUtc" type="datetime-local" />
      </div>
      <div class="field">
        <label for="start">开始时间 *</label>
        <input id="start" v-model="form.startLocal" required type="datetime-local" />
      </div>
      <div class="field">
        <label for="end">结束时间 *</label>
        <input id="end" v-model="form.endLocal" required type="datetime-local" />
      </div>
      <div class="field">
        <label for="recurrence">重复方式</label>
        <select id="recurrence" v-model="form.recurrence.kind">
          <option value="none">不重复</option><option value="weekly">每周</option><option value="biweekly">每两周</option><option value="monthly">每月同日</option>
        </select>
      </div>
      <div v-if="showUntil" class="field">
        <label for="recurrence-until">重复至 *</label>
        <input id="recurrence-until" v-model="form.recurrence.untilLocal" required type="datetime-local" />
        <small>最长 12 个月；月度重复遇到不存在的日期时跳过该月。</small>
      </div>
    </div>
    <div class="inline">
      <button class="button" type="submit" :disabled="busy">{{ busy ? '正在保存…' : submitLabel }}</button>
      <span class="fine-print">所有时间会保存原始时区，并在网站中换算为北京时间。</span>
    </div>
  </form>
</template>
