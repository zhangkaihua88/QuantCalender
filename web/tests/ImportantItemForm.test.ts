import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImportantItemForm from '../src/components/ImportantItemForm.vue'

describe('ImportantItemForm', () => {
  it('limits member submissions to PPA and competition topics', () => {
    const wrapper = mount(ImportantItemForm)
    expect(wrapper.text()).toContain('PPA 主题')
    expect(wrapper.text()).toContain('比赛主题')
    expect(wrapper.text()).not.toContain('奖金日程')
  })

  it('accepts direct eight-digit typing without expanding the year', async () => {
    const wrapper = mount(ImportantItemForm)
    const start = wrapper.find('#important-start')
    await start.setValue('20260101')

    expect(start.attributes('type')).toBe('text')
    expect(start.attributes('maxlength')).toBe('10')
    expect((start.element as HTMLInputElement).value).toBe('2026-01-01')
  })

  it('allows replacing only the year of an existing date', async () => {
    const wrapper = mount(ImportantItemForm, { props:{ initial:{ startDate:'2025-01-01' } } })
    const start = wrapper.find('#important-start')

    await start.setValue('2-01-01')
    await start.setValue('20-01-01')
    await start.setValue('202-01-01')
    await start.setValue('2026-01-01')

    expect((start.element as HTMLInputElement).value).toBe('2026-01-01')
  })

  it('shows bonus milestone fields to administrators and preserves markdown on submit', async () => {
    const wrapper = mount(ImportantItemForm, { props:{ allowBonus:true } })
    await wrapper.findAll('.item-kind-switch button')[2]!.trigger('click')
    expect(wrapper.text()).toContain('账单日期（可选）')
    await wrapper.find('#important-title').setValue('季度薪酬')
    await wrapper.find('#important-start').setValue('2026-07-01')
    await wrapper.find('#important-end').setValue('2026-09-30')
    await wrapper.find('#important-announcement').setValue('2026-11-24')
    await wrapper.find('#important-content').setValue('## 说明\n\n**预计日期**')
    await wrapper.find('form').trigger('submit')
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as { kind:string; contentMarkdown:string; announcementDate:string }
    expect(submitted.kind).toBe('bonus')
    expect(submitted.contentMarkdown).toBe('## 说明\n\n**预计日期**')
    expect(submitted.announcementDate).toBe('2026-11-24')
  })
})
