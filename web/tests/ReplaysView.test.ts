import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import { session } from '../src/state'
import ReplaysView from '../src/views/ReplaysView.vue'

vi.mock('../src/api', () => ({ api:vi.fn(), ApiError:class ApiError extends Error {} }))

describe('ReplaysView', () => {
  beforeEach(() => {
    session.user = { role:'member', memberId:'member-1', wqIdHint:'••••1234', country:'CN', publicWqId:true, expiresAt:'2099-01-01T00:00:00Z' }
    vi.mocked(api).mockResolvedValue({
      groups: [{ id:'group-1', eventId:'event-1', occurrenceKey:'2026-07-24T12:00:00Z', title:'顾问周会', meetingDate:'2026-07-24', links:[
        { id:'link-1', provider:'baidu', providerLabel:'百度网盘', shareUrl:'https://pan.baidu.com/s/a', accessCode:'3k8p', note:'完整录像', contributorWqId:'KZ12345', contributorHasFullWqId:true, openReportCount:0, reportedByMe:false },
        { id:'link-2', provider:'quark', providerLabel:'夸克网盘', shareUrl:'https://pan.quark.cn/s/b', accessCode:'', note:'备用来源', contributorWqId:'AB', contributorHasFullWqId:false, openReportCount:1, reportedByMe:false }
      ] }],
      pagination: { page:1, pageSize:20, total:1, totalPages:1 }
    })
  })

  it('groups multiple member links under one meeting card', async () => {
    const wrapper = mount(ReplaysView, { global:{ stubs:{ RouterLink:{ props:['to'], template:'<a><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.findAll('.replay-card')).toHaveLength(1)
    expect(wrapper.findAll('.replay-source')).toHaveLength(2)
    expect(wrapper.text()).toContain('百度网盘')
    expect(wrapper.text()).toContain('夸克网盘')
    expect(wrapper.text()).toContain('KZ12345')
    expect(wrapper.text()).toContain('贡献者：AB')
    expect(wrapper.text()).not.toContain('6789')
    expect(wrapper.text()).toContain('已有 1 人反馈')
  })
})
