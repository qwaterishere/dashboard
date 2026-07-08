import { Routes } from '@angular/router';

import { AppShellTemplateComponent } from './ui/templates/app-shell/app-shell-template.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellTemplateComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/sales/pages/sales-page/sales-page.component').then(
            (m) => m.SalesPageComponent,
          ),
      },
      {
        path: 'warehouse',
        loadComponent: () =>
          import('./features/warehouse/pages/warehouse-page/warehouse-page.component').then(
            (m) => m.WarehousePageComponent,
          ),
      },
      {
        path: 'foodcost',
        loadComponent: () =>
          import('./features/foodcost/pages/foodcost-page/foodcost-page.component').then(
            (m) => m.FoodcostPageComponent,
          ),
      },
      {
        path: 'purchases',
        loadComponent: () =>
          import('./features/purchases/pages/purchases-page/purchases-page.component').then(
            (m) => m.PurchasesPageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings-page/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/support/pages/support-page/support-page.component').then(
            (m) => m.SupportPageComponent,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
