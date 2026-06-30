import {
  FmtPipe,
  MoneyPipe,
  SignedPctPipe,
  SignedPpPipe,
  PctPipe,
  MillionsPipe,
} from './format.pipes';

describe('format pipes', () => {
  it('fmt formats integers with ru-RU grouping', () => {
    expect(new FmtPipe().transform(8144000)).toBe('8 144 000');
  });

  it('money adds ruble suffix', () => {
    expect(new MoneyPipe().transform(2140)).toMatch(/2\s?140 ₽/);
  });

  it('signedPct uses minus sign U+2212 for negative values', () => {
    expect(new SignedPctPipe().transform(-1.2)).toBe('−1,2 %');
    expect(new SignedPctPipe().transform(8.4)).toBe('+8,4 %');
  });

  it('signedPp formats percentage points', () => {
    expect(new SignedPpPipe().transform(1.2)).toBe('+1,2 п.п.');
  });

  it('pct uses comma decimal separator', () => {
    expect(new PctPipe().transform(31.2)).toBe('31,2 %');
  });

  it('millions formats large values', () => {
    expect(new MillionsPipe().transform(22100000)).toBe('22,1 млн');
  });
});
