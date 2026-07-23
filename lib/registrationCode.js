import { createHash, randomInt } from 'crypto'

// Unambiguous alnum set — drops 0/O and 1/I so a code read aloud or handwritten
// off an email doesn't get mistyped.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)]
  }
  return code
}

export function hashCode(code) {
  return createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex')
}
