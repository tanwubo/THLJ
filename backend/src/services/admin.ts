export function getAdminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) {
    return false
  }

  return getAdminUsernames().includes(username)
}
