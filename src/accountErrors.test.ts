import { describe, expect, it } from 'vitest'
import { checkPassword, checkUsername, friendlyAuthError, messageFor } from './accountErrors'

describe('account checks', () => {
  it('asks for a simple username and an 8 character password', () => {
    expect(checkUsername('ab')).toBe('Use 3 or more letters or numbers')
    expect(checkUsername('qb1')).toBeNull()
    expect(checkPassword('short')).toBe('Password needs 8 or more letters or numbers')
    expect(checkPassword('yardline')).toBeNull()
  })
})

describe('friendlyAuthError', () => {
  it('uses plain language for the account mistakes kids hit', () => {
    expect(
      friendlyAuthError({ status: 400, data: { username: { code: 'validation_not_unique', message: 'taken' } } }, 'signup'),
    ).toBe('That username is taken')
    expect(friendlyAuthError({ status: 400, message: 'Failed to authenticate.' }, 'signin')).toBe(
      'Wrong username or password',
    )
    expect(
      friendlyAuthError({ status: 400, data: { password: { code: 'validation_length_out_of_range' } } }, 'signup'),
    ).toBe('Password needs 8 or more letters or numbers')
    expect(friendlyAuthError({ status: 400, data: { oldPassword: { code: 'validation_invalid' } } }, 'password')).toBe(
      'That old password is not right',
    )
    expect(friendlyAuthError({ status: 0 }, 'signin')).toBe("You're offline. Try again when you have a signal.")
    expect(
      friendlyAuthError(
        {
          status: 400,
          data: {
            data: { password: { code: 'validation_min_text_constraint', message: 'Must be at least 8 character(s).' } },
            message: 'Failed to create record.',
          },
        },
        'signup',
      ),
    ).toBe('Password needs 8 or more letters or numbers')
  })

  it('keeps a message we already wrote', () => {
    expect(messageFor(new Error('Those passwords do not match'), 'signup')).toBe('Those passwords do not match')
  })
})
