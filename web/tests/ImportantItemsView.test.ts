import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import ImportantItemsView from '../src/views/ImportantItemsView.vue'

vi.mock('../src/api', () => ({ api:vi.fn(), ApiError:class ApiError extends Error {} }))

const items = [
  { id:'ppa-1', uid:'ppa-1@example', status:'published', kind:'ppa', title:'夏季 PPA', contentMarkdown:'**主题内容**', startDate:'2026-08-03', endDate:'2026-08-05', announcementDate:null, paymentDate:null, submittedByMember:true, sequence:1, reviewNote:'', createdAt:'2026-08-01T00:00:00Z', updatedAt:'2026-08-01T00:00:00Z' },
  { id:'competition-1', uid:'competition-1@example', status:'cancelled', kind:'competition', title:'历史比赛', contentMarkdown:'比赛内容', startDate:'2026-05-01', endDate:'2026-05-02', announcementDate:null, paymentDate:null, submittedByMember:false, sequence:2, reviewNote:'', createdAt:'2026-04-01T00:00:00Z', updatedAt:'2026-05-01T00:00:00Z' },
  { id:'bonus-1', uid:'bonus-1@example', status:'published', kind:'bonus', title:'季度薪酬', contentMarkdown:'', startDate:'2026-07-01', endDate:'2026-09-30', announcementDate:'2026-11-24', paymentDate:'2026-12-31', submittedByMember:false, sequence:1, reviewNote:'', createdAt:'2026-07-01T00:00:00Z', updatedAt:'2026-07-01T00:00:00Z' }
]

describe('ImportantItemsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T02:00:00Z'))
    vi.mocked(api).mockResolvedValue({ items })
  })
  afterEach(() => vi.useRealTimers())

  it('shows current, future and historical records together', async () => {
    const wrapper = mount(ImportantItemsView, { global:{ stubs:{ RouterLink:{ template:'<a><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.text()).toContain('夏季 PPA')
    expect(wrapper.text()).toContain('历史比赛')
    expect(wrapper.text()).toContain('季度薪酬')
    expect(wrapper.text()).toContain('已取消')
    expect(wrapper.text()).not.toContain('历史事项')
    expect(wrapper.text()).toContain('适用周期')
    expect(wrapper.text()).toContain('2026年7月1日—2026年9月30日')
  })

  it('places a multi-day topic on every covered calendar date', async () => {
    const wrapper = mount(ImportantItemsView, { global:{ stubs:{ RouterLink:{ template:'<a><slot /></a>' } } } })
    await flushPromises()
    await wrapper.findAll('.calendar-page-actions .segmented button')[1]!.trigger('click')
    expect(wrapper.findAll('.important-chip').filter((chip) => chip.text() === '夏季 PPA')).toHaveLength(3)
    expect(wrapper.findAll('.important-chip').filter((chip) => chip.text().includes('季度薪酬'))).toHaveLength(0)
    const nextMonth = wrapper.find('[aria-label="下一个月"]')
    await nextMonth.trigger('click')
    await nextMonth.trigger('click')
    await nextMonth.trigger('click')
    expect(wrapper.text()).toContain('公布 · 季度薪酬')
    expect(wrapper.findAll('.important-chip').filter((chip) => chip.text() === '公布 · 季度薪酬')).toHaveLength(1)
  })
})
