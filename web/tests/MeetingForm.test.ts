import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingForm from '../src/components/MeetingForm.vue'

describe('MeetingForm', () => {
  it('renders the required meeting fields', () => {
    const wrapper = mount(MeetingForm)
    expect(wrapper.find('#meeting-title').exists()).toBe(true)
    expect(wrapper.find('#registration-url').attributes('type')).toBe('url')
    expect(wrapper.text()).toContain('不要填写含密码')
  })

  it('converts the Beijing registration deadline to UTC', async () => {
    const wrapper = mount(MeetingForm)
    await wrapper.find('#deadline').setValue('2026-08-01T18:30')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ registrationDeadlineUtc: '2026-08-01T10:30:00.000Z' })
  })
})
