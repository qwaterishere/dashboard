import { Routes } from '@angular/router';

import { AppShellHostComponent } from './ui/templates/app-shell/app-shell-host.component';
import { AuthLayoutTemplateComponent } from './ui/templates/auth-layout/auth-layout-template.component';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutTemplateComponent,
    canMatch: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login-page/login-page.component').then(
            (m) => m.LoginPageComponent,
          ),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/pages/register-page/register-page.component').then(
            (m) => m.RegisterPageComponent,
          ),
      },
    ],
  },
  {
    path: '',
    component: AppShellHostComponent,
    canMatch: [authGuard],
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
        path: 'targets',
        loadComponent: () =>
          import('./features/targets/pages/targets-page/targets-page.component').then(
            (m) => m.TargetsPageComponent,
          ),
      },
      {
        path: 'purchases',
        redirectTo: 'targets',
        pathMatch: 'full',
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
  { path: '**', redirectTo: 'dashboard' },
];
