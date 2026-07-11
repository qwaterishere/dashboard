import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { TextComponent } from '../../atoms/text/text.component';
import { SettingsSectionComponent } from './settings-section.component';

interface SettingsSectionStoryArgs {
  title: string;
  description: string;
  showDescription: boolean;
}

const meta: Meta<SettingsSectionStoryArgs> = {
  title: 'Molecules/SettingsSection',
  component: SettingsSectionComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    showDescription: { control: 'boolean', description: 'Показать подзаголовок' },
  },
};

export default meta;
type Story = StoryObj<SettingsSectionStoryArgs>;

export const Default: Story = {
  args: {
    title: 'Профиль',
    description: 'Имя и должность отображаются в интерфейсе. Email изменить нельзя без подтверждения.',
    showDescription: true,
  },
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [TextComponent] },
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-settings-section
          [title]="title"
          [description]="showDescription ? description : undefined"
        >
          <app-text tone="muted">Слот section__body — форма или контент секции</app-text>
        </app-settings-section>
      </div>
    `,
  }),
};
