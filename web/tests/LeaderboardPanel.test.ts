import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import LeaderboardPanel from '../src/components/LeaderboardPanel.vue'

vi.mock('../src/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {}
}))

describe('LeaderboardPanel', () => {
  beforeEach(() => {
    vi.mocked(api).mockResolvedValue({
      summary: { contributorCount: 2, submissionCount: 8, approvedCount: 5, approvalRate: 62.5 },
      pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
      entries: [
        { rank: 1, memberId: 'member-1', wqId: 'KZ', hasFullWqId: false, country: 'CN', submissionCount: 5, approvedCount: 4, approvalRate: 80, isCurrentUser: true },
        { rank: 2, memberId: 'member-2', wqId: 'AB', hasFullWqId: false, country: 'HK', submissionCount: 3, approvedCount: 1, approvalRate: 33.3, isCurrentUser: false }
      ]
    })
  })

  it('renders submission and approval rankings with the current member marked', async () => {
    const wrapper = mount(LeaderboardPanel, { global: { stubs: { RouterLink: { template:'<a><slot /></a>' } } } })
    await flushPromises()

    expect(wrapper.text()).toContain('会议投稿')
    expect(wrapper.text()).toContain('通过会议')
    expect(wrapper.text()).toContain('KZ')
    expect(wrapper.text()).not.toContain('1234')
    expect(wrapper.text()).toContain('通过 4 次')
    expect(wrapper.find('.current-user-row').text()).toContain('我')
  })

  it('loads a separate replay ranking ordered around contributed meetings', async () => {
    const wrapper = mount(LeaderboardPanel, { global: { stubs: { RouterLink: { template:'<a><slot /></a>' } } } })
    await flushPromises()
    vi.mocked(api).mockResolvedValueOnce({
      summary: { contributorCount:1, submissionCount:3, approvedCount:2, contributedMeetingCount:1, approvalRate:66.7 },
      pagination: { page:1, pageSize:50, total:1, totalPages:1 },
      entries: [{ rank:1, memberId:'member-1', wqId:'KZ12345', hasFullWqId:true, country:'CN', submissionCount:3, approvedCount:2, contributedMeetingCount:1, approvalRate:66.7, isCurrentUser:true }]
    })
    await wrapper.findAll('.leaderboard-switch button')[1]!.trigger('click')
    await flushPromises()
    expect(vi.mocked(api).mock.calls.at(-1)?.[0]).toContain('kind=replay')
    expect(wrapper.text()).toContain('贡献会议')
    expect(wrapper.text()).toContain('贡献 1 场会议')
  })

  it('loads the important item contribution ranking as a third category', async () => {
    const wrapper = mount(LeaderboardPanel, { global: { stubs: { RouterLink: { template:'<a><slot /></a>' } } } })
    await flushPromises()
    vi.mocked(api).mockResolvedValueOnce({
      summary: { contributorCount:1, submissionCount:2, approvedCount:1, approvalRate:50 },
      pagination: { page:1, pageSize:50, total:1, totalPages:1 },
      entries: [{ rank:1, memberId:'member-1', wqId:'KZ', hasFullWqId:false, country:'CN', submissionCount:2, approvedCount:1, approvalRate:50, isCurrentUser:true }]
    })
    await wrapper.findAll('.leaderboard-switch button')[2]!.trigger('click')
    await flushPromises()
    expect(vi.mocked(api).mock.calls.at(-1)?.[0]).toContain('kind=important')
    expect(wrapper.text()).toContain('重要事项投稿排行榜')
    expect(wrapper.text()).toContain('通过事项')
  })
})
