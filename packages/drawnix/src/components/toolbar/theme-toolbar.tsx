import { useBoard } from '@plait-board/react-board';
import classNames from 'classnames';
import { ATTACHED_ELEMENT_CLASS_NAME, BoardTransforms, ThemeColorMode } from '@plait/core';
import { Island } from '../island';
import { Select } from '../select/select';
import { useI18n } from '../../i18n';

/** 主题选项：value 与 ThemeColorMode 对齐，名称用现有 i18n 键 */
const THEME_OPTIONS = [
  { value: 'default', labelKey: 'theme.default' },
  { value: 'colorful', labelKey: 'theme.colorful' },
  { value: 'soft', labelKey: 'theme.soft' },
  { value: 'retro', labelKey: 'theme.retro' },
  { value: 'dark', labelKey: 'theme.dark' },
  { value: 'starry', labelKey: 'theme.starry' },
] as const;

export const ThemeToolbar = () => {
  const board = useBoard();
  const { t } = useI18n();
  const theme = board.theme;
  const current = THEME_OPTIONS.find((option) => option.value === theme.themeColorMode);
  return (
    <Island padding={1} className={classNames('theme-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}>
      {/* 原生 select 的下拉弹出层由系统按元素屏幕坐标定位，在窗口边缘会弹出窗外；
          改用浮层 Select 组件：按钮在右下角默认向上展开，flip 中间件兑底防出窗 */}
      <Select.Root
        value={theme.themeColorMode}
        onValueChange={(value) => {
          BoardTransforms.updateThemeColor(board, value as ThemeColorMode);
        }}
        placement="top-end"
      >
        <Select.Trigger className="theme-toolbar__trigger">
          {current ? t(current.labelKey) : theme.themeColorMode}
        </Select.Trigger>
        <Select.Content
          container={document.querySelector('.drawnix')}
          className="theme-toolbar__content"
        >
          {THEME_OPTIONS.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {t(option.labelKey)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Island>
  );
};
