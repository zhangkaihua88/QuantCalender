import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingForm from '../src/components/MeetingForm.vue'

describe('MeetingForm', () => {
  it('renders the required meeting fields', () => {
    const wrapper = mount(MeetingForm)
    expect(wrapper.find('#meeting-title').exists()).toBe(true)
    expect(wrapper.find('#registration-url').attributes('type')).toBe('url')
    expect((wrapper.find('#duration').element as HTMLSelectElement).value).toBe('60')
    expect(wrapper.find('#meeting-summary').exists()).toBe(false)
    expect(wrapper.find('#organizer').exists()).toBe(false)
    expect(wrapper.find('#end').exists()).toBe(false)
    expect(wrapper.text()).toContain('北京时间')
    expect(wrapper.text()).toContain('不要填写含密码')
  })

  it('defaults to a one-hour meeting and fills internal fields', async () => {
    const wrapper = mount(MeetingForm)
    await wrapper.find('#meeting-title').setValue('顾问周会')
    await wrapper.find('#start').setValue('2026-08-01T18:30')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      title: '顾问周会',
      summary: '顾问周会',
      organizer: 'WQ',
      sourceTimezone: 'Asia/Shanghai',
      startLocal: '2026-08-01T18:30:00',
      endLocal: '2026-08-01T19:30:00',
      registrationDeadlineUtc: null
    })
  })
})
