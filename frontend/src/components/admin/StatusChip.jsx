/**
 * 意见状态标签（pending → 橙「待处理」/ resolved → 绿「已处理」）
 *
 * props：status
 * 颜色只走 .tag--pending / .tag--resolved，不自定义色值（保证三色上限）。
 *
 * 用法：<StatusChip status={row.status} />
 */

import { FEEDBACK_STATUS } from '../../lib/constants.js';
import Tag from '../ui/Tag.jsx';

/**
 * 状态标签。
 * @param {{ status?: string }} props
 * @returns {JSX.Element}
 */
export function StatusChip({ status }) {
  const safe = status === 'resolved' ? 'resolved' : 'pending';
  return <Tag variant={safe}>{FEEDBACK_STATUS[safe]}</Tag>;
}

export default StatusChip;
