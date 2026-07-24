import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import CalendarSettingsView from '../src/views/CalendarSettingsView.vue'
import { session } from '../src/state'

vi.mock('../src/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {}
}))

describe('CalendarSettingsView', () => {
  it('keeps a saved no-reminder preference selected', async () => {
    vi.mocked(api).mockResolvedValue({
      feed: { exists: true, alarm_minutes: 0 }
    })

    const wrapper = mount(CalendarSettingsView)
    await flushPromises()

    const select = wrapper.find('#default-alarm')
    expect(select.text()).toContain('不提醒')
    expect((select.element as HTMLSelectElement).value).toBe('0')
  })

  it('updates the global contributor identity preference', async () => {
    session.user = { role:'member', memberId:'member-1', wqIdHint:'••••1234', country:'CN', publicWqId:true, expiresAt:'2099-01-01T00:00:00Z' }
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === '/v1/calendar-feed') return { feed:{ exists:false, alarm_minutes:30 } }
      if (path === '/v1/me/preferences') return { user:{ ...session.user!, publicWqId:false } }
      return {}
    })
    const wrapper = mount(CalendarSettingsView)
    await flushPromises()
    await wrapper.find('.preference-toggle input').setValue(false)
    await flushPromises()
    const preferenceCall = vi.mocked(api).mock.calls.find(([path]) => path === '/v1/me/preferences')
    expect(preferenceCall?.[1]?.method).toBe('PATCH')
    expect(preferenceCall?.[1]?.body).toContain('"publicWqId":false')
    expect(session.user?.publicWqId).toBe(false)
  })
})
