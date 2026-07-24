import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AboutView from '../src/views/AboutView.vue'

describe('member guide', () => {
  it('shows member workflows instead of the old explanation content', () => {
    const wrapper = mount(AboutView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('成员使用指南')
    expect(wrapper.text()).toContain('查找并注册会议')
    expect(wrapper.text()).toContain('提交会议')
    expect(wrapper.text()).toContain('查看审核结果')
    expect(wrapper.text()).toContain('设置日历提醒')
    expect(wrapper.text()).not.toContain('身份说明')
    expect(wrapper.text()).not.toContain('数据最小化')
  })
})
