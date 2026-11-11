/// <reference types="jest" />
import { tabItemWidth } from '../WeyroTabBar';

describe('tabItemWidth', () => {
  it('splits the screen evenly across tabs', () => {
    expect(tabItemWidth(390, 5)).toBe(78);
    expect(tabItemWidth(430, 5)).toBe(86);
    expect(tabItemWidth(390, 6)).toBe(65);
  });

  it('never divides by zero', () => {
    expect(tabItemWidth(390, 0)).toBe(390);
  });
});
