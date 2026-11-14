/**
 * 最近操作日志（DESIGN / P-25：仪表盘右侧，最多 8 条）
 *
 * props：logs=[{ id, module, action, targetName, result, createdAt }]
 * 每条：模块 Tag + 动作 + 目标 + 相对时间；失败记录用 pending 橙标签提示。
 *
 * 用法：<RecentLogList logs={logs} />
 */

import { LOG_ACTION_LABELS, LOG_MODULE_LABELS } from '../../lib/constants.js';
import { fromNow } from '../../lib/format.js';
import Tag from '../ui/Tag.jsx';

/** 列表最多条数 */
const MAX_ITEMS = 8;

/**
 * 最近操作日志。
 * @param {{ logs?: Array<object> }} props
 * @returns {JSX.Element}
 */
export function RecentLogList({ logs = [] }) {
  const list = (Array.isArray(logs) ? logs : []).slice(0, MAX_ITEMS);

  if (!list.length) {
    return <p className="recent-log__empty">还没有操作记录</p>;
  }

  return (
    <div className="recent-log">
      {list.map((log) => {
        const moduleLabel = LOG_MODULE_LABELS[log.module] || log.module || '其它';
        const actionLabel = LOG_ACTION_LABELS[log.action] || log.action || '操作';
        const failed = log.result === 'fail';
        return (
          <div className="recent-log__item" key={log.id}>
            <div className="recent-log__head">
              <Tag variant="region" size="sm">
                {moduleLabel}
              </Tag>
              <span className="recent-log__action">{actionLabel}</span>
              <span className="recent-log__target">{log.targetName || '—'}</span>
              {failed ? (
                <Tag variant="pending" size="sm">
                  失败
                </Tag>
              ) : null}
            </div>
            <span className="recent-log__time">{fromNow(log.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default RecentLogList;
