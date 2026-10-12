import { checkPassword, checkUsername } from './accountErrors'
import { pb } from './pb'
import { syncNow } from './sync'

export async function signUp(username: string, password: string, passwordConfirm: string) {
  const nameError = checkUsername(username)
  if (nameError) throw new Error(nameError)
  const passError = checkPassword(password)
  if (passError) throw new Error(passError)
  if (password !== passwordConfirm) throw new Error('Those passwords do not match')
  const name = username.trim()
  await pb.collection('users').create({ username: name, password, passwordConfirm })
  await pb.collection('users').authWithPassword(name, password)
  await syncNow()
}

export async function signIn(username: string, password: string) {
  const nameError = checkUsername(username)
  if (nameError) throw new Error(nameError)
  const passError = checkPassword(password)
  if (passError) throw new Error(passError)
  await pb.collection('users').authWithPassword(username.trim(), password)
  await syncNow()
}

export function signOut() {
  pb.authStore.clear()
}

/** Deletes this login. The server drops that person's plays and playbooks with it. */
export async function deleteAccount(): Promise<void> {
  const id = pb.authStore.record?.id
  if (!id) throw new Error('Sign in first.')
  await pb.collection('users').delete(id)
  pb.authStore.clear()
}

export async function changePassword(oldPassword: string, password: string, passwordConfirm: string) {
  if (!oldPassword) throw new Error('Type your old password')
  const passError = checkPassword(password)
  if (passError) throw new Error(passError)
  if (password !== passwordConfirm) throw new Error('Those passwords do not match')
  const id = pb.authStore.record?.id
  const username = pb.authStore.record?.username
  if (!id || typeof username !== 'string') throw new Error('Sign in first.')
  await pb.collection('users').update(id, { oldPassword, password, passwordConfirm })
  await pb.collection('users').authWithPassword(username, password)
}
