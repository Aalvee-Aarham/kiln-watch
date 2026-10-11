import { describe, expect, it } from 'vitest'
import { numbers, unsupportedNumbers } from './geminiPrompt'

describe('unsupportedNumbers', () => {
  const ctx = 'Current Season: 2023-24. The district has had 7 unusual days.'
  it('passes numbers the context gave', () => expect(unsupportedNumbers('7 unusual days in 2023-24', ctx)).toEqual([]))
  it('blocks a digit that only appears inside a larger context number', () => expect(unsupportedNumbers('3 unusual days', ctx)).toEqual([3]))
  it('reads Bangla digits', () => expect(unsupportedNumbers('৯ দিন', ctx)).toEqual([9]))
  it('compares by value, ignoring thousands separators', () => expect([...numbers('1,221,809 and 0.5')]).toEqual([1221809, 0.5]))
})
