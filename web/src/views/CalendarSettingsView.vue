<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, Copy, RefreshCw, Trash2 } from 'lucide-vue-next'
import { api, ApiError } from '../api'
import { session } from '../state'

const exists = ref(false)
const alarmMinutes = ref(30)
const feedUrl = ref('')
const error = ref('')
const copied = ref(false)
const busy = ref(false)
const publicWqId = ref(session.user?.publicWqId ?? true)
const identityBusy = ref(false)

onMounted(async () => {
  try { const data = await api<{ feed: any }>('/v1/calendar-feed'); exists.value = data.feed.exists; alarmMinutes.value = data.feed.alarm_minutes ?? 30 }
  catch (caught) { error.value = caught instanceof ApiError ? caught.message : '加载订阅设置失败' }
})

async function generate() {
  busy.value = true; error.value = ''
  try { const data = await api<{ url: string }>('/v1/calendar-feed', { method:'POST', body:JSON.stringify({ alarmMinutes: alarmMinutes.value }) }); feedUrl.value = data.url; exists.value = true }
  catch (caught) { error.value = caught instanceof ApiError ? caught.message : '生成失败' }
  finally { busy.value = false }
}
async function updateAlarm() { if (!exists.value) return; await api('/v1/calendar-feed', { method:'PATCH', body:JSON.stringify({ alarmMinutes: alarmMinutes.value }) }) }
async function updateIdentity() {
  identityBusy.value = true; error.value = ''
  try {
    const data = await api<{ user: NonNullable<typeof session.user> }>('/v1/me/preferences', { method:'PATCH', body:JSON.stringify({ publicWqId: publicWqId.value }) })
    session.user = data.user
  } catch (caught) { error.value = caught instanceof ApiError ? caught.message : '身份显示设置保存失败'; publicWqId.value = !publicWqId.value }
  finally { identityBusy.value = false }
}
async function copy() { if (!feedUrl.value) return; await navigator.clipboard.writeText(feedUrl.value); copied.value = true; setTimeout(() => copied.value = false, 1800) }
async function revoke() { if (!confirm('撤销后，旧订阅地址将立即失效。确定继续吗？')) return; await api('/v1/calendar-feed', { method:'DELETE' }); exists.value = false; feedUrl.value = '' }
</script>

<template>
  <div class="page-head"><div><p class="eyebrow">MEMBER SETTINGS</p><h1>成员设置</h1><p class="subtitle">管理排行榜身份显示和个人日历订阅。</p></div></div>
  <div v-if="error" class="error-box" style="margin-bottom:14px">{{ error }}</div>
  <div class="panel-grid">
    <div class="stack">
      <section class="card card-body stack"><div><h2>贡献者身份显示</h2><p class="subtitle">此设置统一作用于会议榜、回放榜和回放来源卡片；管理员始终可以查看完整 WQ_ID。</p></div><label class="preference-toggle"><input v-model="publicWqId" type="checkbox" :disabled="identityBusy" @change="updateIdentity" /><span><strong>向登录成员显示完整 WQ_ID</strong><small>{{ publicWqId ? '当前显示完整 ID；关闭后仅显示末四位。' : '当前仅显示末四位提示。' }}</small></span></label></section>
      <section class="card card-body stack">
        <div><h2>个人日历提醒</h2><p class="subtitle">生成专属订阅地址后，可加入 Google、Outlook 或 Apple Calendar。地址等同于访问凭证，请勿转发。</p></div>
        <div class="notice-box">订阅刷新频率由日历客户端决定，可能不是即时。网站会保持会议 UID 稳定，并同步改期、取消和重复会议例外。</div>
        <div class="field"><label for="default-alarm">默认提前提醒</label><select id="default-alarm" v-model="alarmMinutes" @change="updateAlarm"><option :value="0">不提醒</option><option :value="10">10 分钟</option><option :value="30">30 分钟</option><option :value="60">1 小时</option><option :value="1440">1 天</option></select></div>
        <div v-if="feedUrl" class="field"><label for="feed-url">新订阅地址（仅显示这一次）</label><input id="feed-url" :value="feedUrl" readonly /><button class="button secondary" @click="copy"><Check v-if="copied" :size="17" /><Copy v-else :size="17" />{{ copied ? '已复制' : '复制地址' }}</button></div>
        <div class="inline"><button class="button" :disabled="busy" @click="generate"><RefreshCw :size="17" />{{ exists ? '旋转并生成新地址' : '生成订阅地址' }}</button><button v-if="exists" class="button danger" @click="revoke"><Trash2 :size="17" />撤销订阅</button></div>
      </section>
    </div>
    <aside class="card card-body"><h2>添加方法</h2><ol class="detail-copy"><li>点击生成并复制私密地址。</li><li>在个人日历中选择“从 URL 订阅”或“添加订阅日历”。</li><li>粘贴地址并保存。</li></ol><p class="fine-print">单场下载只是快照；只有 URL 订阅能持续获取更新。</p></aside>
  </div>
</template>
