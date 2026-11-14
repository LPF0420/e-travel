/**
 * P-16 意见建议管理（F-28、F-29）
 *
 * 路由：/admin/feedbacks
 * 接口：
 *   GET   /api/admin/feedbacks?status&page&pageSize → { list, total, page, pageSize, totalPages, pendingCount }
 *   PATCH /api/admin/feedbacks/:id { status: 'pending' | 'resolved' } → { id, status, handledAt }
 *
 * 交互：
 * - 状态筛选（全部 / 待处理 / 已处理）+ 分页（PAGE_SIZE.ADMIN）；
 * - 每条展示：昵称（游客 / 会员）、联系方式、提交时间、内容（默认 3 行折叠，可展开）；
 * - 「标记已处理」成功后**局部更新**该条 + Toast，不整页重取（保留当前滚动位置）。
 */

import { useCallback, useEffect, useState } from 'react';

import FilterBar from '../../components/admin/FilterBar.jsx';
import StatusChip from '../../components/admin/StatusChip.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS, FEEDBACK_STATUS_OPTIONS, PAGE_SIZE } from '../../lib/constants.js';
import { get, patch } from '../../lib/api.js';
import { formatDateTime, truncate } from '../../lib/format.js';

/** 折叠时展示的字数上限（约 3 行） */
const COLLAPSED_LENGTH = 90;

/**
 * 意见建议管理页。
 * @returns {JSX.Element}
 */
export function FeedbackList() {
  const { showToast } = useToast();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [busyId, setBusyId] = useState(0);

  /**
   * 拉取列表。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(ADMIN_PATHS.FEEDBACKS, {
        scope: 'admin',
        query: { status, page, pageSize: PAGE_SIZE.ADMIN },
      });
      setList(data && Array.isArray(data.list) ? data.list : []);
      setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
      setPendingCount(data && Number.isFinite(Number(data.pendingCount)) ? Number(data.pendingCount) : 0);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setList([]);
      setTotal(0);
      setError((err && err.message) || '意见建议加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 切换筛选状态（回到第一页）。
   * @param {string} next
   */
  const handleStatusChange = (next) => {
    setStatus(next);
    setPage(1);
    setExpanded({});
  };

  /** 重置筛选 */
  const handleReset = () => {
    setStatus('');
    setPage(1);
    setExpanded({});
  };

  /**
   * 标记已处理（局部更新）。
   * @param {object} item
   */
  const handleResolve = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const data = await patch(
        `${ADMIN_PATHS.FEEDBACKS}/${item.id}`,
        { status: 'resolved' },
        { scope: 'admin' },
      );
      const nextStatus = data && data.status ? data.status : 'resolved';
      // 当前筛选是「待处理」时，处理完的条目不再属于该列表 → 就地移除并修正计数
      if (status === 'pending') {
        setList((prev) => prev.filter((row) => row.id !== item.id));
        setTotal((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        setList((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, status: nextStatus, handledAt: data ? data.handledAt : null } : row,
          ),
        );
      }
      setPendingCount((prev) => (item.status === 'pending' && prev > 0 ? prev - 1 : prev));
      showToast('已标记为已处理', 'success');
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      showToast((err && err.message) || '操作失败，请稍后重试', 'error');
    } finally {
      setBusyId(0);
    }
  };

  /**
   * 展开 / 收起正文。
   * @param {number} id
   */
  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const hasFilter = status !== '';
  const isEmpty = !loading && list.length === 0;

  return (
    <div className="a-fb">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">意见建议</h1>
          <p className="admin-head__desc">
            来自前台「联系我们」的留言，共 {total} 条{status === '' && pendingCount > 0 ? `，其中 ${pendingCount} 条待处理` : ''}。
          </p>
        </div>
      </div>

      <FilterBar onReset={handleReset} showReset={hasFilter}>
        <Select value={status} onChange={handleStatusChange} options={FEEDBACK_STATUS_OPTIONS} placeholder="全部状态" />
      </FilterBar>

      {error ? (
        <p className="form-alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <Spinner label="正在加载意见建议" /> : null}

      {isEmpty ? (
        <EmptyState
          art="inbox"
          title={hasFilter ? '当前筛选下没有留言' : '还没有收到意见建议'}
          desc={hasFilter ? '试试切换状态筛选或重置条件' : '前台访客提交留言后会出现在这里'}
          actionText={hasFilter ? '查看全部留言' : ''}
          onAction={hasFilter ? handleReset : undefined}
        />
      ) : null}

      {!loading && list.length ? (
        <div className="a-fb__list">
          {list.map((item) => {
            const content = item.content || '';
            const isOpen = Boolean(expanded[item.id]);
            const needToggle = content.length > COLLAPSED_LENGTH;
            const isPending = item.status === 'pending';

            return (
              <article className="a-fb__item" key={item.id}>
                <div className="a-fb__head">
                  <span className="a-fb__who">
                    {item.nickname || '匿名'}
                    <span className="tag tag--muted tag--sm">{item.memberId ? '会员' : '游客'}</span>
                  </span>
                  <span className="a-fb__meta">
                    <span>{item.contact || '未留联系方式'}</span>
                    <span className="a-fb__dot" aria-hidden="true">
                      ·
                    </span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </span>
                  <StatusChip status={item.status} />
                </div>

                <p className="a-fb__content">{isOpen || !needToggle ? content : truncate(content, COLLAPSED_LENGTH)}</p>

                <div className="a-fb__actions">
                  {needToggle ? (
                    <button type="button" className="a-fb__toggle" onClick={() => toggleExpanded(item.id)}>
                      {isOpen ? '收起正文' : '展开全文'}
                    </button>
                  ) : null}
                  {isPending ? (
                    <Button size="sm" loading={busyId === item.id} onClick={() => handleResolve(item)}>
                      标记已处理
                    </Button>
                  ) : (
                    <span className="a-fb__done">
                      已处理{item.handledAt ? ` · ${formatDateTime(item.handledAt)}` : ''}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {total > PAGE_SIZE.ADMIN ? (
        <div className="a-page-foot">
          <Pagination page={page} pageSize={PAGE_SIZE.ADMIN} total={total} onChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

export default FeedbackList;
