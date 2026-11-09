/**
 * 简单模板插值：把文案中的 {name} 占位符替换为参数值。
 * i18n 的 t() 只返回模板字符串，带参数的文案（如「已保存「{name}」到本地文件」）
 * 统一经由此函数渲染；缺参数时保留占位符原样，便于发现问题。
 */
export const formatTemplate = (
  template: string,
  params?: Record<string, string | number>
): string => {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
};
