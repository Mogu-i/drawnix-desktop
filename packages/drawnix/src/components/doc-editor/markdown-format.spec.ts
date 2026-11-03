import { describe, expect, it } from 'vitest';
import {
  applyMarkdownAction,
  continueListOnEnter,
  indentSelection,
  MarkdownActionOptions,
  toggleTaskItem,
} from './markdown-format';

const apply = (
  action: Parameters<typeof applyMarkdownAction>[0],
  text: string,
  start = 0,
  end = text.length,
  options?: MarkdownActionOptions
) => applyMarkdownAction(action, text, start, end, options);

describe('applyMarkdownAction', () => {
  it('wraps the selection with bold markers', () => {
    const result = apply('bold', 'hello world', 0, 5);
    expect(result.text).toBe('**hello** world');
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(7);
  });

  it('removes bold markers when the surroundings already have them', () => {
    const result = apply('bold', '**hello** world', 2, 7);
    expect(result.text).toBe('hello world');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(5);
  });

  it('wraps the selection with inline code backticks', () => {
    const result = apply('inlineCode', 'use const here', 4, 9);
    expect(result.text).toBe('use `const` here');
    expect(result.selectionStart).toBe(5);
    expect(result.selectionEnd).toBe(10);
  });

  it('adds a heading prefix to the covered line only', () => {
    const result = apply('h1', 'title\nsecond line', 0, 5);
    expect(result.text).toBe('# title\nsecond line');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(7);
  });

  it('removes the heading prefix when toggled again', () => {
    const result = apply('h1', '# title', 0, 7);
    expect(result.text).toBe('title');
  });

  it('replaces an existing heading level', () => {
    const result = apply('h3', '## title', 0, 8);
    expect(result.text).toBe('### title');
  });

  it('numbers each line when applying an ordered list', () => {
    const result = apply('orderedList', 'a\nb\nc', 0, 5);
    expect(result.text).toBe('1. a\n2. b\n3. c');
  });

  it('removes the list prefix when every line already has it', () => {
    const result = apply('unorderedList', '- a\n- b', 0, 6);
    expect(result.text).toBe('a\nb');
  });

  it('applies the task list prefix with an unchecked checkbox', () => {
    const result = apply('taskList', 'todo item', 0, 9);
    expect(result.text).toBe('- [ ] todo item');
  });

  it('applies the quote prefix', () => {
    const result = apply('quote', 'said', 0, 4);
    expect(result.text).toBe('> said');
  });

  it('wraps the selection in a fenced code block', () => {
    const result = apply('codeBlock', 'before\nconst a = 1;\nafter', 7, 19);
    expect(result.text).toBe('before\n```\nconst a = 1;\n```\n\nafter');
    expect(result.selectionStart).toBe(11);
    expect(result.selectionEnd).toBe(23);
  });

  it('inserts an empty fenced code block and places the cursor inside', () => {
    const result = apply('codeBlock', '', 0, 0);
    expect(result.text).toBe('```\n\n```\n');
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('inserts a link template and selects the label', () => {
    const result = apply('link', 'abc', 3, 3, { linkPlaceholder: '链接文字' });
    expect(result.text).toBe('abc[链接文字]()');
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(8);
  });

  it('uses the selection as the link label and places the cursor at the url', () => {
    const result = apply('link', 'see docs here', 4, 8);
    expect(result.text).toBe('see [docs]() here');
    expect(result.selectionStart).toBe(11);
    expect(result.selectionEnd).toBe(11);
  });

  it('inserts an image template with an alt placeholder', () => {
    const result = apply('image', '', 0, 0, { imagePlaceholder: '图片描述' });
    expect(result.text).toBe('![图片描述](url)');
    expect(result.selectionStart).toBe(2);
    expect(result.selectionEnd).toBe(6);
  });

  it('inserts a table template at the cursor', () => {
    const template = '| A | B |\n| --- | --- |\n|  |  |';
    const result = apply('table', 'hi', 2, 2, { tableTemplate: template });
    expect(result.text).toBe(`hi\n${template}\n`);
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it('inserts a horizontal rule', () => {
    const result = apply('horizontalRule', 'above', 5, 5);
    expect(result.text).toBe('above\n---\n');
    expect(result.selectionStart).toBe(10);
    expect(result.selectionEnd).toBe(10);
  });
});

describe('continueListOnEnter', () => {
  const enter = (text: string, cursor = text.length) => continueListOnEnter(text, cursor);

  it('returns null for a plain text line', () => {
    expect(enter('plain line')).toBeNull();
  });

  it('continues an unordered list item', () => {
    const result = enter('- first item');
    expect(result).toEqual({
      text: '- first item\n- ',
      selectionStart: 15,
      selectionEnd: 15,
    });
  });

  it('continues a task list item with an unchecked checkbox', () => {
    const result = enter('- [ ] todo');
    expect(result?.text).toBe('- [ ] todo\n- [ ] ');
  });

  it('increments the ordered list number', () => {
    const result = enter('1. first');
    expect(result?.text).toBe('1. first\n2. ');
  });

  it('continues a blockquote', () => {
    const result = enter('> quote');
    expect(result?.text).toBe('> quote\n> ');
  });

  it('keeps the indentation of nested list items', () => {
    const result = enter('  - nested');
    expect(result?.text).toBe('  - nested\n  - ');
  });

  it('splits the line when the cursor is inside the content', () => {
    const result = enter('- abcd', 4);
    expect(result?.text).toBe('- ab\n- cd');
  });

  it('removes the prefix to exit the list when the item is empty', () => {
    const result = enter('- item\n- ', 10);
    expect(result?.text).toBe('- item\n');
    expect(result?.selectionStart).toBe(7);
  });

  it('exits an empty task list item', () => {
    const result = enter('- [ ] ');
    expect(result?.text).toBe('');
  });
});

describe('indentSelection', () => {
  const indent = (text: string, start = 0, end = text.length) =>
    indentSelection(text, start, end, 'indent');
  const outdent = (text: string, start = 0, end = text.length) =>
    indentSelection(text, start, end, 'outdent');

  it('inserts the indent unit at the cursor without a selection', () => {
    const result = indent('abc', 1, 1);
    expect(result.text).toBe('a  bc');
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  it('indents every covered line with a selection', () => {
    const result = indent('a\nb\nc', 0, 4);
    expect(result.text).toBe('  a\n  b\n  c');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(11);
  });

  it('outdents up to two leading spaces per line with a selection', () => {
    const result = outdent('    a\n  b', 0, 9);
    expect(result.text).toBe('  a\nb');
  });

  it('outdents a leading tab as one unit', () => {
    const result = outdent('\ta\n\tb');
    expect(result.text).toBe('a\nb');
  });

  it('outdents the current line and shifts the cursor back without a selection', () => {
    const result = outdent('  abc', 5, 5);
    expect(result.text).toBe('abc');
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  it('moves the cursor to the line start when it sits inside removed indent', () => {
    const result = outdent('  abc', 1, 1);
    expect(result.text).toBe('abc');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(0);
  });
});

describe('toggleTaskItem', () => {
  it('checks the task item at the given index', () => {
    const text = '- [ ] a\n- [ ] b';
    expect(toggleTaskItem(text, 1)).toBe('- [ ] a\n- [x] b');
  });

  it('unchecks an already checked task item', () => {
    expect(toggleTaskItem('- [x] done', 0)).toBe('- [ ] done');
  });

  it('keeps nested indentation of the task item', () => {
    expect(toggleTaskItem('  - [ ] nested', 0)).toBe('  - [x] nested');
  });

  it('toggles an ordered task list item', () => {
    const text = '1. [ ] first\n2. [ ] second';
    expect(toggleTaskItem(text, 1)).toBe('1. [ ] first\n2. [x] second');
  });

  it('skips task-like lines inside code fences when counting', () => {
    const text = '```\n- [ ] not a task\n```\n- [ ] real task';
    expect(toggleTaskItem(text, 0)).toBe('```\n- [ ] not a task\n```\n- [x] real task');
  });

  it('leaves other lines untouched', () => {
    expect(toggleTaskItem('- item\nplain', 0)).toBe('- item\nplain');
  });
});
