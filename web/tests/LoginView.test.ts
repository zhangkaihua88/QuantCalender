import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '../src/views/LoginView.vue'
import { login } from '../src/api'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRouter:() => ({ push:routerPush }) }))
vi.mock('../src/api', () => ({ login:vi.fn(), ApiError:class ApiError extends Error {} }))

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAAAAAAA-test-site-key')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('asks for human verification without sending a login request', async () => {
    const wrapper = mount(LoginView)
    await wrapper.find('#wq-id').setValue('KZ79256')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('请先完成人机验证')
    expect(login).not.toHaveBeenCalled()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
