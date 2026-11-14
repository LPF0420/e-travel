/**
 * 标签（DESIGN §6.2 `.tag`，颜色只允许 6 个变体，保证三色上限）
 *
 * props：children, variant='region'|'recommend'|'level'|'pending'|'resolved'|'muted', size
 *
 * 用法：<Tag variant="region">四川</Tag>
 *      <Tag variant="recommend">推荐</Tag>
 *      <Tag variant="level">5A</Tag>
 */

import { FEEDBACK_STATUS } from '../../lib/constants.js';

/** 合法变体（非法值回落 muted，绝不自造颜色） */
const VARIANTS = ['region', 'recommend', 'level', 'pending', 'resolved', 'muted'];
/** 合法尺寸 */
const SIZES = ['md', 'sm'];

/**
 * 标签。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Tag({ children, variant = 'region', size = 'md', className = '', ...rest }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'muted';
  const safeSize = SIZES.includes(size) ? size : 'md';
  const classes = ['tag', `tag--${safeVariant}`];
  if (safeSize === 'sm') classes.push('tag--sm');
  if (className) classes.push(className);

  return (
    <span className={classes.join(' ')} {...rest}>
      {children}
    </span>
  );
}

/**
 * 意见反馈状态标签（pending → 橙「待处理」/ resolved → 绿「已处理」）。
 * 页面里可直接 `<Tag variant={fb.status}>{FEEDBACK_STATUS[fb.status]}</Tag>`；
 * 这里提供语义化包装，避免各页重复写映射。
 *
 * @param {{ status: 'pending'|'resolved' }} props
 * @returns {JSX.Element}
 */
export function StatusTag({ status }) {
  const safe = status === 'resolved' ? 'resolved' : 'pending';
  return <Tag variant={safe}>{FEEDBACK_STATUS[safe] || safe}</Tag>;
}

export default Tag;
