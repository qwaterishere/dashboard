import { Pipe, PipeTransform, inject } from '@angular/core';

import { CurrencyService } from '../../core/state/currency.service';
import { formatMoney } from '../utils/money-format.utils';

@Pipe({ name: 'fmt', standalone: true })
export class FmtPipe implements PipeTransform {
  transform(n: number): string {
    return Math.round(n).toLocaleString('ru-RU');
  }
}

/** Impure: пересчитывается при смене валюты в настройках. */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(n: number): string {
    // Читаем signal, чтобы pipe зависел от смены валюты при impure-проверке.
    this.currency.code();
    return formatMoney(n);
  }
}

@Pipe({ name: 'currencySymbol', standalone: true, pure: false })
export class CurrencySymbolPipe implements PipeTransform {
  private readonly currency = inject(CurrencyService);

  transform(_trigger?: unknown): string {
    return this.currency.symbol();
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
    const value = Number.isFinite(n) ? n : 0;
    return `${value.toFixed(1).replace('.', ',')} %`;
  }
}

@Pipe({ name: 'pctInt', standalone: true })
export class PctIntPipe implements PipeTransform {
  transform(n: number): string {
    const value = Number.isFinite(n) ? n : 0;
    return `${Math.round(value)} %`;
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
    const value = Number.isFinite(n) ? n : 0;
    const sign = value >= 0 ? '+' : '−';
    return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
  }
}

@Pipe({ name: 'signedPp', standalone: true })
export class SignedPpPipe implements PipeTransform {
  transform(n: number): string {
    const value = Number.isFinite(n) ? n : 0;
    const sign = value >= 0 ? '+' : '−';
    return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} п.п.`;
  }
}

export const FORMAT_PIPES = [
  FmtPipe,
  MoneyPipe,
  CurrencySymbolPipe,
  KFormatPipe,
  MillionsPipe,
  PctPipe,
  PctIntPipe,
  DecimalPipe,
  SignedPctPipe,
  SignedPpPipe,
] as const;
