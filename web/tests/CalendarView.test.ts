import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import CalendarView from '../src/views/CalendarView.vue'

vi.mock('../src/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {}
}))

describe('CalendarView', () => {
  beforeEach(() => {
    vi.mocked(api).mockResolvedValue({
      occurrences: [{
        eventId: 'meeting-1', occurrenceKey: '2099-08-01T10:00:00Z', title: '顾问周会',
        summary: '顾问周会', organizer: 'WQ', speaker: '', category: '培训', meetingLanguage: 'zh',
        locationType: 'online', locationText: '线上会议', registrationUrl: 'https://example.com/register',
        sourceTimezone: 'Asia/Shanghai', startUtc: '2099-08-01T10:00:00Z', endUtc: '2099-08-01T11:00:00Z',
        status: 'published', isException: false
      }, {
        eventId: 'meeting-1', occurrenceKey: '2099-08-08T10:00:00Z', title: '顾问周会',
        summary: '顾问周会', organizer: 'WQ', speaker: '', category: '培训', meetingLanguage: 'zh',
        locationType: 'online', locationText: '线上会议', registrationUrl: 'https://example.com/register',
        sourceTimezone: 'Asia/Shanghai', startUtc: '2099-08-08T10:00:00Z', endUtc: '2099-08-08T11:00:00Z',
        status: 'published', isException: false
      }, {
        eventId: 'meeting-2', occurrenceKey: '2099-08-02T10:00:00Z', title: '研究分享',
        summary: '研究分享', organizer: 'WQ', speaker: '', category: '研究分享', meetingLanguage: 'zh',
        locationType: 'online', locationText: '线上会议', registrationUrl: 'https://example.com/research',
        sourceTimezone: 'Asia/Shanghai', startUtc: '2099-08-02T10:00:00Z', endUtc: '2099-08-02T11:00:00Z',
        status: 'published', isException: false
      }, {
        eventId: 'meeting-2', occurrenceKey: '2099-08-09T10:00:00Z', title: '研究分享',
        summary: '研究分享', organizer: 'WQ', speaker: '', category: '研究分享', meetingLanguage: 'zh',
        locationType: 'online', locationText: '线上会议', registrationUrl: 'https://example.com/research',
        sourceTimezone: 'Asia/Shanghai', startUtc: '2099-08-09T10:00:00Z', endUtc: '2099-08-09T11:00:00Z',
        status: 'published', isException: false
      }]
    })
  })

  it('shows separate detail and direct registration buttons', async () => {
    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a class="router-link"><slot /></a>' }
        }
      }
    })
    await flushPromises()

    const actions = wrapper.find('.hero-actions')
    expect(actions.text()).toContain('查看详情')
    expect(actions.text()).toContain('立即注册')
    const registration = actions.find('a[href="https://example.com/register"]')
    expect(registration.attributes('target')).toBe('_blank')
    expect(registration.attributes('rel')).toContain('noopener')
  })

  it('shows actions on agenda cards and only the nearest occurrence per series', async () => {
    const wrapper = mount(CalendarView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a class="router-link"><slot /></a>' }
        }
      }
    })
    await flushPromises()

    const agendaItems = wrapper.findAll('.agenda-item')
    expect(agendaItems).toHaveLength(1)
    const agendaItem = agendaItems[0]!
    expect(agendaItem.text()).toContain('研究分享')
    expect(agendaItem.text()).toContain('查看详情')
    expect(agendaItem.text()).toContain('立即注册')
    expect(agendaItem.find('a[href="https://example.com/research"]').exists()).toBe(true)
  })
})
