import { Component } from '@angular/core';

/** Полупрозрачный оверлей со спиннером для panel-карточек. */
@Component({
  selector: 'app-panel-busy-overlay',
  standalone: true,
  template: `
    <div class="panel-busy" aria-live="polite" aria-busy="true">
      <span class="panel-busy__spinner" aria-hidden="true"></span>
      <span class="panel-busy__text">Загрузка…</span>
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 2;
      border-radius: inherit;
    }

    .panel-busy {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: color-mix(in srgb, var(--card) 72%, transparent);
    }

    .panel-busy__spinner {
      width: 22px;
      height: 22px;
      border: 2px solid var(--mut2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: panel-busy-spin 0.8s linear infinite;
    }

    .panel-busy__text {
      color: var(--mut2);
      font-size: 0.85rem;
    }

    @keyframes panel-busy-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class PanelBusyOverlayComponent {}
