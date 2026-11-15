/**
 * 文档草稿基线判定（纯函数，无副作用）：
 * 草稿除内容外还记录「写入时磁盘内容的哈希基线 baseHash」，加载时总是先读
 * 一次磁盘并与基线比对——磁盘哈希与基线不一致说明应用关闭/切走期间磁盘被
 * 应用外修改，过期草稿失效（磁盘版本优先），未保存编辑不再无条件覆盖磁盘。
 * 不用 mtime：数据目录是同步盘，时间戳可能被同步工具改写；本地读一次文件
 * 开销可忽略，内容哈希能同时规避时钟漂移与时间戳不可靠问题。
 *
 * 哈希为 FNV-1a 与 djb2 两个 32 位结果拼接的纯同步实现：
 * crypto.subtle 在 jsdom 下不可用，且草稿基线需要同步计算。
 */

/** 文档草稿：content 为编辑中的内容，baseHash 为写入时磁盘内容的哈希 */
export type DocDraft = {
  content: string;
  baseHash: string;
  updatedAt: number;
};

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const DJB2_SEED = 5381;

const toHex32 = (value: number): string => (value >>> 0).toString(16).padStart(8, '0');

/** FNV-1a 32 位哈希（无符号输出） */
const fnv1a32 = (input: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

/** djb2 32 位哈希（无符号输出），与 FNV-1a 拼接降低碰撞概率 */
const djb2Hash32 = (input: string): number => {
  let hash = DJB2_SEED;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash, 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
};

/** 内容哈希：同输入恒定输出，空串有稳定值；双 32 位拼接共 16 个十六进制字符 */
export const hashDocContent = (content: string): string =>
  toHex32(fnv1a32(content)) + toHex32(djb2Hash32(content));

/** 草稿是否过期：磁盘内容哈希与基线不一致即「磁盘已被外部改动」；
 *  draft 为 null（无草稿）不算过期；baseHash 为空（旧版迁移草稿无从校验）恒过期 */
export const isDocDraftStale = (draft: DocDraft | null, diskContent: string): boolean => {
  if (draft === null) {
    return false;
  }
  return hashDocContent(diskContent) !== draft.baseHash;
};
