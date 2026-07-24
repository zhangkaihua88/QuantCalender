import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import AdminReplayPanel from '../src/components/AdminReplayPanel.vue'

vi.mock('../src/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {}
}))

const pendingEntry = {
  id:'link-1', groupId:'group-1', eventId:null, occurrenceKey:null, title:'顾问会议回放', meetingDate:'2026-07-24',
  provider:'baidu', providerLabel:'百度网盘', shareUrl:'https://pan.baidu.com/s/example', accessCode:'1234', note:'完整录像',
  status:'pending', reviewNote:'', contributorWqId:'KZ12345', openReportCount:0, latestReportReason:null, latestReportNote:null,
  createdAt:'2026-07-24T12:00:00Z', approvedAt:null
}

describe('AdminReplayPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api).mockImplementation(async (url) => {
      if (String(url).includes('filter=pending')) {
        return { entries:[pendingEntry], pagination:{ page:1, pageSize:25, total:3, totalPages:1 } }
      }
      return { entries:[], pagination:{ page:1, pageSize:25, total:0, totalPages:1 } }
    })
  })

  it('renders only replay review content when embedded in the combined pending area', async () => {
    const wrapper = mount(AdminReplayPanel, { props:{ pendingOnly:true } })
    await flushPromises()

    expect(vi.mocked(api).mock.calls[0]?.[0]).toContain('filter=pending')
    expect(wrapper.text()).toContain('顾问会议回放')
    expect(wrapper.text()).not.toContain('回放管理')
    expect(wrapper.text()).not.toContain('直接新增')
    expect(wrapper.emitted('pendingCount')?.[0]).toEqual([3])
  })

  it('opens regular replay management on published records without a duplicate pending tab', async () => {
    const wrapper = mount(AdminReplayPanel)
    await flushPromises()

    expect(vi.mocked(api).mock.calls[0]?.[0]).toContain('filter=published')
    expect(wrapper.text()).toContain('回放管理')
    expect(wrapper.text()).toContain('已发布')
    expect(wrapper.text()).not.toContain('待审核')
  })
})
