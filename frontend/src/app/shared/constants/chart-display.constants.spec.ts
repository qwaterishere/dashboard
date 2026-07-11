import {
  availableChartDisplayModes,
  chartDisplayOptionsForTimeframe,
} from './chart-display.constants';

describe('chart-display.constants', () => {
  it('limits week timeframe to days only', () => {
    expect(availableChartDisplayModes('week')).toEqual(['day']);
    expect(chartDisplayOptionsForTimeframe('week').map((o) => o.value)).toEqual(['day']);
  });

  it('limits month timeframe to days and weeks', () => {
    expect(availableChartDisplayModes('month')).toEqual(['day', 'week']);
    expect(chartDisplayOptionsForTimeframe('month').map((o) => o.value)).toEqual(['day', 'week']);
  });

  it('keeps month and quarter for year timeframe', () => {
    expect(availableChartDisplayModes('year')).toEqual(['month', 'quarter']);
  });
});
