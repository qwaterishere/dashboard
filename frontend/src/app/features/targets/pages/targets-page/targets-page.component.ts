import { Component, effect, inject } from '@angular/core';

import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { TargetsLayoutTemplateComponent } from '../../../../ui/templates/targets-layout/targets-layout-template.component';
import type { TargetsFormState } from '../../../../shared/models/targets.model';
import { buildTargetsFormState } from '../../data/targets-form.utils';
import { TargetsDataStore } from '../../data/targets-data.store';
import { TargetsFormOrganismComponent } from '../../organisms/targets-form/targets-form-organism.component';

@Component({
  selector: 'app-targets-page',
  standalone: true,
  imports: [LoadErrorComponent, TargetsLayoutTemplateComponent, TargetsFormOrganismComponent],
  template: `
    <app-targets-layout-template>
      @if (store.data.hasValue() && formState) {
        <app-targets-form-organism
          [data]="store.data.value()"
          [(form)]="formState"
        />
      } @else if (store.data.error()) {
        <app-load-error message="Не удалось загрузить цели" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </app-targets-layout-template>
  `,
  styles: `
    :host {
      display: block;
    }

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }
  `,
})
export class TargetsPageComponent {
  protected readonly store = inject(TargetsDataStore);
  protected formState: TargetsFormState | null = null;

  private loadedPeriodKey = '';

  constructor() {
    effect(() => {
      if (!this.store.data.hasValue()) {
        return;
      }
      const data = this.store.data.value();
      const periodKey = `${data.period.year}-${data.period.month}`;
      if (periodKey === this.loadedPeriodKey) {
        return;
      }
      this.loadedPeriodKey = periodKey;
      this.formState = buildTargetsFormState(data);
    });
  }
}
