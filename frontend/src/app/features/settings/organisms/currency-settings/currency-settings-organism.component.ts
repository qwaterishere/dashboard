import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CurrencyService } from '../../../../core/state/currency.service';
import type { CurrencyCode } from '../../../../shared/constants/currency.constants';
import { SettingsSectionComponent } from '../../../../ui/molecules/settings-section/settings-section.component';

@Component({
  selector: 'app-currency-settings-organism',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SettingsSectionComponent],
  template: `
    <app-settings-section
      title="Валюта"
      description="Символ валюты в суммах на дашборде. Не конвертирует данные — меняет только отображение."
    >
      <div class="currency-field">
        <label class="field-label" for="settings-currency">Валюта отображения</label>
        <select
          id="settings-currency"
          class="currency-select"
          name="currency"
          [ngModel]="currency.code()"
          (ngModelChange)="onChange($event)"
        >
          @for (option of currency.currencies; track option.code) {
            <option [value]="option.code">
              {{ option.name }} ({{ option.symbol }})
            </option>
          }
        </select>
      </div>
    </app-settings-section>
  `,
  styles: `
    .currency-field {
      display: grid;
      gap: 6px;
      max-width: 420px;
    }

    .field-label {
      font-weight: 600;
      color: var(--txt);
      font-size: 0.78rem;
    }

    .currency-select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card2);
      color: var(--txt);
      font: inherit;
      font-size: 0.88rem;
      padding: 11px 13px;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;
      cursor: pointer;
    }

    .currency-select:focus {
      outline: none;
      border-color: rgba(110, 107, 255, 0.65);
      box-shadow: 0 0 0 3px rgba(110, 107, 255, 0.18);
    }
  `,
})
export class CurrencySettingsOrganismComponent {
  protected readonly currency = inject(CurrencyService);

  onChange(code: string): void {
    this.currency.setCurrency(code as CurrencyCode);
  }
}
