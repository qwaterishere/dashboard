import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fmt', standalone: true })
export class FmtPipe implements PipeTransform {
  transform(n: number): string {
    return Math.round(n).toLocaleString('ru-RU');
  }
}

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(n: number): string {
    return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
  }
}

@Pipe({ name: 'kFormat', standalone: true })
export class KFormatPipe implements PipeTransform {
  transform(n: number): string {
    return `${Math.round(n / 1000).toLocaleString('ru-RU')}к`;
  }
}

@Pipe({ name: 'millions', standalone: true })
export class MillionsPipe implements PipeTransform {
  transform(n: number): string {
    return `${(n / 1e6).toFixed(1).replace('.', ',')} млн`;
  }
}

@Pipe({ name: 'pct', standalone: true })
export class PctPipe implements PipeTransform {
  transform(n: number): string {
    return `${n.toFixed(1).replace('.', ',')} %`;
  }
}

@Pipe({ name: 'pctInt', standalone: true })
export class PctIntPipe implements PipeTransform {
  transform(n: number): string {
    return `${Math.round(n)} %`;
  }
}

@Pipe({ name: 'decimal', standalone: true })
export class DecimalPipe implements PipeTransform {
  transform(n: number): string {
    return n.toLocaleString('ru-RU');
  }
}

@Pipe({ name: 'signedPct', standalone: true })
export class SignedPctPipe implements PipeTransform {
  transform(n: number): string {
    const sign = n >= 0 ? '+' : '−';
    return `${sign}${Math.abs(n).toFixed(1).replace('.', ',')} %`;
  }
}

@Pipe({ name: 'signedPp', standalone: true })
export class SignedPpPipe implements PipeTransform {
  transform(n: number): string {
    const sign = n >= 0 ? '+' : '−';
    return `${sign}${Math.abs(n).toFixed(1).replace('.', ',')} п.п.`;
  }
}

export const FORMAT_PIPES = [
  FmtPipe,
  MoneyPipe,
  KFormatPipe,
  MillionsPipe,
  PctPipe,
  PctIntPipe,
  DecimalPipe,
  SignedPctPipe,
  SignedPpPipe,
] as const;
