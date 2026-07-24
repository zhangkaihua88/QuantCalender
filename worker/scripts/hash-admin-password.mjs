import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'

const terminal = createInterface({ input: process.stdin, output: process.stdout })
const supplied = process.argv[2]
const password = supplied || await terminal.question('请输入至少 20 位的高强度管理员密码：')
terminal.close()

if (password.length < 20) {
  console.error('管理员密码至少需要 20 位。')
  process.exit(1)
}

console.log(createHash('sha256').update(password).digest('hex').toUpperCase())
console.log(`建议的会话密钥：${randomBytes(32).toString('base64url')}`)
console.log(`建议的 WQ_ID HMAC 密钥：${randomBytes(32).toString('base64url')}`)
