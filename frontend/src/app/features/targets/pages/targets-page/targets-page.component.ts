import { Component, effect, inject, viewChild } from '@angular/core';

import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { TargetsLayoutTemplateComponent } from '../../../../ui/templates/targets-layout/targets-layout-template.component';
import type { TargetsFormState } from '../../../../shared/models/targets.model';
import {
  buildTargetsFormState,
  formStateToUpsertRequest,
} from '../../data/targets-form.utils';
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
          (saveRequested)="onSave($event)"
          (clearRequested)="onClear()"
          (lockRequested)="onLock()"
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

  private readonly formRef = viewChild(TargetsFormOrganismComponent);
  private loadedPeriodKey = '';

  constructor() {
    effect(() => {
      if (!this.store.data.hasValue()) {
        return;
      }
      const data = this.store.data.value();
      const periodKey = `${data.period.year}-${data.period.month}-${data.locked ? '1' : '0'}`;
      if (periodKey === this.loadedPeriodKey && this.formState) {
        return;
      }
      this.loadedPeriodKey = periodKey;
      this.formState = buildTargetsFormState(data);
    });
  }

  async onSave(form: TargetsFormState): Promise<void> {
    if (!this.store.data.hasValue() || this.store.data.value().locked) return;
    const data = this.store.data.value();
    const payload = formStateToUpsertRequest(data, form);
    const formOrg = this.formRef();
    try {
      const saved = await this.store.save(payload);
      this.loadedPeriodKey = `${saved.period.year}-${saved.period.month}-${saved.locked ? '1' : '0'}`;
      this.formState = buildTargetsFormState(saved);
      formOrg?.markSaveSuccess(this.formState);
    } catch {
      formOrg?.markSaveError('Не удалось сохранить цели');
    }
  }

  async onClear(): Promise<void> {
    if (!this.store.data.hasValue() || this.store.data.value().locked) return;
    const data = this.store.data.value();
    const formOrg = this.formRef();
    try {
      const cleared = await this.store.clearMonth(data.period.year, data.period.month);
      this.loadedPeriodKey = `${cleared.period.year}-${cleared.period.month}-${cleared.locked ? '1' : '0'}`;
      this.formState = buildTargetsFormState(cleared);
      formOrg?.markClearSuccess(this.formState);
    } catch {
      formOrg?.markSaveError('Не удалось очистить цели');
    }
  }

  async onLock(): Promise<void> {
    if (!this.store.data.hasValue() || this.store.data.value().locked) return;
    const data = this.store.data.value();
    const formOrg = this.formRef();
    try {
      const locked = await this.store.lockMonth(data.period.year, data.period.month);
      this.loadedPeriodKey = `${locked.period.year}-${locked.period.month}-1`;
      this.formState = buildTargetsFormState(locked);
      formOrg?.markLockSuccess(this.formState);
    } catch {
      formOrg?.markSaveError('Не удалось заблокировать цели');
    }
  }
}
