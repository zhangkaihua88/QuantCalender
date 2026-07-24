import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import CalendarSettingsView from '../src/views/CalendarSettingsView.vue'

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
})
