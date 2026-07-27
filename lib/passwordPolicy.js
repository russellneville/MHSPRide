// NIST 800-63B-style standard: prioritize length over forced character-class
// mixes, plus one number-or-symbol so a bare dictionary word isn't enough.
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_REQUIREMENT_TEXT =
  `At least ${PASSWORD_MIN_LENGTH} characters, including at least one number or symbol.`

export function getPasswordError(password) {
  if (!password) return 'Password is required'
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one number or symbol.'
  }
  return null
}

export function isPasswordValid(password) {
  return getPasswordError(password) === null
}
