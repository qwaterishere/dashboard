import type { Preview } from '@storybook/angular';

type AppTheme = 'light' | 'dark';

const THEME_BACKGROUNDS: Record<AppTheme, string> = {
  dark: '#0d1220',
  light: '#eef1f7',
};

function applyTheme(theme: AppTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.style.background = THEME_BACKGROUNDS[theme];
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Тема',
      description: 'Светлая / тёмная тема приложения (`data-theme`)',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Тёмная' },
          { value: 'light', title: 'Светлая' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [
    (storyFn, context) => {
      const theme = (context.globals['theme'] as AppTheme | undefined) ?? 'dark';
      applyTheme(theme);
      return storyFn();
    },
  ],
  parameters: {
    layout: 'centered',
    backgrounds: {
      disable: true,
    },
  },
};

export default preview;
