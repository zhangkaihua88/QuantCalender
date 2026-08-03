<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ImportantItemInput, ImportantItemKind } from '@wq-calendar/shared'
import MarkdownContent from './MarkdownContent.vue'

const props = withDefaults(defineProps<{
  initial?: Partial<ImportantItemInput>
  busy?: boolean
  allowBonus?: boolean
  submitLabel?: string
}>(), { busy: false, allowBonus: false, submitLabel: '提交审核' })

const emit = defineEmits<{ submit: [item: ImportantItemInput] }>()
const mode = ref<'edit' | 'preview'>('edit')

function initialForm(): ImportantItemInput {
  return {
    kind: props.initial?.kind || 'ppa',
    title: props.initial?.title || '',
    contentMarkdown: props.initial?.contentMarkdown || '',
    startDate: props.initial?.startDate || '',
    endDate: props.initial?.endDate || '',
    announcementDate: props.initial?.announcementDate || null,
    paymentDate: props.initial?.paymentDate || null
  }
}

const form = reactive<ImportantItemInput>(initialForm())
watch(() => props.initial, () => Object.assign(form, initialForm()), { deep: true })

const isBonus = computed(() => form.kind === 'bonus')

function chooseKind(kind: ImportantItemKind) {
  form.kind = kind
  if (kind !== 'bonus') {
    form.announcementDate = null
    form.paymentDate = null
  }
}

function submit() {
  emit('submit', {
    ...form,
    contentMarkdown: form.contentMarkdown.trim(),
    announcementDate: isBonus.value ? form.announcementDate || null : null,
    paymentDate: isBonus.value ? form.paymentDate || null : null
  })
}
</script>

<template>
  <form class="stack important-item-form" @submit.prevent="submit">
    <div class="field">
      <label>类别 *</label>
      <div class="segmented item-kind-switch">
        <button type="button" :class="{ active: form.kind === 'ppa' }" @click="chooseKind('ppa')">PPA 主题</button>
        <button type="button" :class="{ active: form.kind === 'competition' }" @click="chooseKind('competition')">比赛主题</button>
        <button v-if="allowBonus" type="button" :class="{ active: form.kind === 'bonus' }" @click="chooseKind('bonus')">奖金日程</button>
      </div>
    </div>

    <div class="form-grid">
      <div class="field wide"><label for="important-title">{{ isBonus ? '奖金名称' : '主题' }} *</label><input id="important-title" v-model="form.title" required minlength="2" maxlength="120" /></div>
      <div class="field"><label for="important-start">{{ isBonus ? '周期开始' : '开始日期' }} *</label><input id="important-start" v-model="form.startDate" required type="date" /></div>
      <div class="field"><label for="important-end">{{ isBonus ? '周期结束' : '结束日期' }} *</label><input id="important-end" v-model="form.endDate" required type="date" /></div>
      <template v-if="isBonus">
        <div class="field"><label for="important-announcement">公布日期（可选）</label><input id="important-announcement" v-model="form.announcementDate" type="date" /></div>
        <div class="field"><label for="important-payment">发放日期（可选）</label><input id="important-payment" v-model="form.paymentDate" type="date" /></div>
      </template>
    </div>

    <div class="field">
      <div class="field-label-row">
        <label for="important-content">{{ isBonus ? '说明（可选）' : '内容 *' }}</label>
        <div class="segmented markdown-mode"><button type="button" :class="{ active: mode === 'edit' }" @click="mode='edit'">编辑</button><button type="button" :class="{ active: mode === 'preview' }" @click="mode='preview'">预览</button></div>
      </div>
      <textarea v-if="mode === 'edit'" id="important-content" v-model="form.contentMarkdown" :required="!isBonus" maxlength="8000" rows="8" placeholder="支持 ## 标题、**粗体**、列表、引用、行内代码和 HTTPS 链接" />
      <div v-else class="markdown-preview"><MarkdownContent v-if="form.contentMarkdown" :content="form.contentMarkdown" /><span v-else class="muted">暂无可预览内容</span></div>
      <small>支持基础 Markdown；不支持 HTML、图片、视频、表格或非 HTTPS 链接。</small>
    </div>

    <button class="button" type="submit" :disabled="busy">{{ busy ? '正在保存…' : submitLabel }}</button>
  </form>
</template>
