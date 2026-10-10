import { describe, expect, it } from 'vitest'
import { chooseBookName } from './bookName'

describe('playbook name sync', () => {
  it('uploads a phone name when the account has none', () => {
    const choice = chooseBookName({ name: 'Friday Night', namedAt: 20 }, { name: '', namedAt: 0 })
    expect(choice).toEqual({ name: 'Friday Night', namedAt: 20, push: true })
  })

  it('keeps the newer account name', () => {
    const choice = chooseBookName({ name: 'Night Yard', namedAt: 0 }, { name: 'Dawgs', namedAt: 50 })
    expect(choice).toEqual({ name: 'Dawgs', namedAt: 50, push: false })
  })

  it('keeps a newer phone name and sends it up', () => {
    const choice = chooseBookName({ name: 'Saturday', namedAt: 80 }, { name: 'Dawgs', namedAt: 50 })
    expect(choice).toEqual({ name: 'Saturday', namedAt: 80, push: true })
  })

  it('does not let an unstamped default replace a stored account name', () => {
    const choice = chooseBookName({ name: 'Night Yard', namedAt: 0 }, { name: 'Dawgs', namedAt: 0 })
    expect(choice.name).toBe('Dawgs')
    expect(choice.push).toBe(false)
  })

  it('leaves a matching name alone', () => {
    const choice = chooseBookName({ name: 'Dawgs', namedAt: 50 }, { name: 'Dawgs', namedAt: 50 })
    expect(choice.push).toBe(false)
    expect(choice.name).toBe('Dawgs')
  })
})
