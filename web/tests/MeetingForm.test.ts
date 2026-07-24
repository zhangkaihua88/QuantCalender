import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { meetingInputSchema } from '@wq-calendar/shared'
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
    await wrapper.find('#registration-url').setValue('https://example.com/register')
    await wrapper.find('#start').setValue('2026-08-01T18:30')
    await wrapper.find('form').trigger('submit')
    const payload = wrapper.emitted('submit')?.[0]?.[0]
    expect(payload).toMatchObject({
      title: '顾问周会',
      startLocal: '2026-08-01T18:30:00',
      durationMinutes: 60
    })
    expect(meetingInputSchema.safeParse(payload).success).toBe(true)
  })
})
