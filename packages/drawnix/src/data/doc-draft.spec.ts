import { describe, expect, it } from 'vitest';
import { hashDocContent, isDocDraftStale, type DocDraft } from './doc-draft';

const makeDraft = (baseHash: string): DocDraft => ({
  content: 'draft content',
  baseHash,
  updatedAt: 0,
});

describe('hashDocContent', () => {
  it('returns the same value for the same input (stability)', () => {
    const content = '家庭网络信息/端口管理\n测试\n第二行';
    expect(hashDocContent(content)).toBe(hashDocContent(content));
  });

  it('returns a stable non-empty value for the empty string', () => {
    const emptyHash = hashDocContent('');
    // 32 位双哈希拼接共 16 个十六进制字符
    expect(emptyHash).toMatch(/^[0-9a-f]{16}$/);
    expect(hashDocContent('')).toBe(emptyHash);
  });

  it('produces different hashes for different contents', () => {
    const base = hashDocContent('old content');
    expect(hashDocContent('old content ')).not.toBe(base);
    expect(hashDocContent('old contenT')).not.toBe(base);
    expect(hashDocContent('\u0000')).not.toBe(base);
    // 仅差一个字符也不相同
    expect(hashDocContent('测试')).not.toBe(hashDocContent('测试 '));
  });

  it('is length-sensitive (appending content changes the hash)', () => {
    const base = hashDocContent('line1\nline2');
    expect(hashDocContent('line1\nline2\n')).not.toBe(base);
    expect(hashDocContent('line1\nline2\nline3')).not.toBe(base);
  });
});

describe('isDocDraftStale', () => {
  it('is never stale without a draft', () => {
    expect(isDocDraftStale(null, 'anything on disk')).toBe(false);
  });

  it('is fresh when the disk content matches the base hash', () => {
    const diskContent = 'disk version';
    const draft = makeDraft(hashDocContent(diskContent));
    expect(isDocDraftStale(draft, diskContent)).toBe(false);
  });

  it('is stale when the disk content differs from the base hash', () => {
    const draft = makeDraft(hashDocContent('disk version at draft time'));
    expect(isDocDraftStale(draft, 'changed outside the app')).toBe(true);
  });

  it('treats an empty base hash as stale (legacy draft without a baseline)', () => {
    // 旧版迁移草稿 baseHash 为空：磁盘无论是什么内容都判定过期
    const legacyDraft = makeDraft('');
    expect(isDocDraftStale(legacyDraft, '')).toBe(true);
    expect(isDocDraftStale(legacyDraft, 'disk content')).toBe(true);
  });
});
