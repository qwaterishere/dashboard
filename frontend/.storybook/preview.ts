import type { Preview } from '@storybook/angular';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0d1220' },
        { name: 'light', value: '#eef1f7' },
      ],
    },
  },
};

export default preview;
