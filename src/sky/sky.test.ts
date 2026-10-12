import { describe, expect, it } from 'vitest';
import { skyColors } from './sky';

const brightness = ([r, g, b]: number[]) => (r * 0.3 + g * 0.59 + b * 0.11) / 255;

describe('sky colours', () => {
  it('is bright at noon and dark at midnight', () => {
    expect(brightness(skyColors(12, 'clear').top)).toBeGreaterThan(0.5);
    expect(brightness(skyColors(0, 'clear').top)).toBeLessThan(0.15);
  });

  it('turns warm at sunset', () => {
    const [r, , b] = skyColors(19, 'clear').top;
    expect(r).toBeGreaterThan(b);
  });

  it('gets greyer and darker in a storm', () => {
    const clear = skyColors(14, 'clear').top, storm = skyColors(14, 'storm').top;
    expect(brightness(storm)).toBeLessThan(brightness(clear));
    const spread = (c: number[]) => Math.max(...c) - Math.min(...c);
    expect(spread(storm)).toBeLessThan(spread(clear)); // less colourful
  });

  it('wraps hours safely', () => {
    expect(skyColors(24, 'clear')).toEqual(skyColors(0, 'clear'));
  });
});
