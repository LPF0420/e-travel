/**
 * P-14 会员列表（F-26）
 *
 * 路由：/admin/members
 * 接口：
 *   GET /api/admin/members?keyword&page&pageSize&sortBy&order → 分页包（list/total/...）
 *   GET /api/admin/logs/member-logins?pageSize=100            → 用于「最后登录」列
 *
 * 说明（与后端契约的差异）：
 * 后端 `publicMember` 投影不含 lastLoginAt（会员表也没有该字段），列表页无法直接拿到「最后登录」。
 * 这里额外取一次最近 100 条会员登录日志，按会员名建「最后登录时间」映射（后端日志按时间倒序，
 * 取每个会员名首次出现的时间即最新）。取不到就显示「—」，不臆造数据。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FilterBar from '../../components/admin/FilterBar.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Input from '../../components/ui/Input.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import { ADMIN_PATHS, MEMBER_SORT_OPTIONS, PAGE_SIZE } from '../../lib/constants.js';
import { get } from '../../lib/api.js';
import { formatDateTime, initialOf } from '../../lib/format.js';

/** 默认排序（注册时间新→旧） */
const DEFAULT_SORT = MEMBER_SORT_OPTIONS[0].value;
/** 会员登录日志单次最多取 100 条（后端上限） */
const LOGIN_LOG_LIMIT = 100;

/**
 * 会员列表页。
 * @returns {JSX.Element}
 */
export function MemberList() {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [sortValue, setSortValue] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoginMap, setLastLoginMap] = useState({});

  // 关键词防抖：300ms 后提交查询并回到第一页
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = keyword.trim();
      setQuery((prev) => (prev === next ? prev : next));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  /**
   * 拉取会员列表 + 最近登录日志（并行，日志失败不影响列表）。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    const sort = MEMBER_SORT_OPTIONS.find((item) => item.value === sortValue) || MEMBER_SORT_OPTIONS[0];
    setLoading(true);
    setError('');

    const [membersResult, logsResult] = await Promise.allSettled([
      get(ADMIN_PATHS.MEMBERS, {
        scope: 'admin',
        query: {
          keyword: query,
          page,
          pageSize: PAGE_SIZE.ADMIN,
          sortBy: sort.sortBy,
          order: sort.order,
        },
      }),
      get(ADMIN_PATHS.LOG_MEMBER_LOGINS, {
        scope: 'admin',
        query: { page: 1, pageSize: LOGIN_LOG_LIMIT },
      }),
    ]);

    if (membersResult.status === 'fulfilled') {
      const data = membersResult.value || {};
      setList(Array.isArray(data.list) ? data.list : []);
      setTotal(Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
    } else {
      const err = membersResult.reason;
      setList([]);
      setTotal(0);
      if (!(err && (err.status === 401 || err.status === 403))) {
        setError((err && err.message) || '会员列表加载失败，请稍后重试');
      }
    }

    if (logsResult.status === 'fulfilled') {
      const data = logsResult.value || {};
      const logs = Array.isArray(data.list) ? data.list : [];
      const map = {};
      // 后端按时间倒序，首次出现即该会员最近一次登录
      logs.forEach((item) => {
        const name = item && item.username ? item.username : '';
        if (name && !map[name]) map[name] = item.createdAt || '';
      });
      setLastLoginMap(map);
    } else {
      setLastLoginMap({});
    }

    setLoading(false);
  }, [query, page, sortValue]);

  useEffect(() => {
    load();
  }, [load]);

  /** 重置筛选 */
  const handleReset = () => {
    setKeyword('');
    setQuery('');
    setSortValue(DEFAULT_SORT);
    setPage(1);
  };

  const hasFilter = keyword !== '' || sortValue !== DEFAULT_SORT;

  const columns = useMemo(
    () => [
      {
        key: 'username',
        title: '会员名',
        render: (row) => (
          <span className="a-member__name">
            <span className="avatar avatar--sm">{initialOf(row.username)}</span>
            <span className="table__primary">{row.username || '—'}</span>
          </span>
        ),
      },
      { key: 'phone', title: '手机号', width: '140px', render: (row) => row.phone || '—' },
      { key: 'email', title: '邮箱', width: '200px', render: (row) => row.email || '—' },
      {
        key: 'favoriteCount',
        title: '收藏数',
        width: '90px',
        align: 'right',
        render: (row) => (
          <span className="table__cell--num">{Number.isFinite(Number(row.favoriteCount)) ? row.favoriteCount : 0}</span>
        ),
      },
      {
        key: 'createdAt',
        title: '注册时间',
        width: '150px',
        sortable: true,
        sortKey: 'createdAt',
        render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.createdAt)}</span>,
      },
      {
        key: 'lastLoginAt',
        title: '最后登录',
        width: '150px',
        render: (row) => {
          const at = lastLoginMap[row.username];
          return <span className="table__cell--nowrap">{at ? formatDateTime(at) : '—'}</span>;
        },
      },
      {
        key: 'actions',
        title: '操作',
        width: '90px',
        align: 'right',
        render: (row) => (
          <div className="a-row-actions" onClick={(event) => event.stopPropagation()}>
            <Button size="sm" variant="text" onClick={() => navigate(`/admin/members/${row.id}`)}>
              详情
            </Button>
          </div>
        ),
      },
    ],
    [lastLoginMap, navigate],
  );

  /**
   * 列头排序：ID / 注册时间（后端只支持这两列）。
   * @param {string} sortKey
   * @param {'asc'|'desc'} nextOrder
   */
  const handleSort = (sortKey, nextOrder) => {
    const next = `${sortKey}:${nextOrder}`;
    const matched = MEMBER_SORT_OPTIONS.some((item) => item.value === next);
    if (!matched) return;
    setSortValue(next);
    setPage(1);
  };

  const currentSort = MEMBER_SORT_OPTIONS.find((item) => item.value === sortValue) || MEMBER_SORT_OPTIONS[0];

  return (
    <div className="a-member">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">会员管理</h1>
          <p className="admin-head__desc">共 {total} 位注册会员，可按会员名、手机号或邮箱搜索。</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>
          刷新
        </Button>
      </div>

      <FilterBar onReset={handleReset} showReset={hasFilter}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索会员名 / 手机号 / 邮箱"
        />
        <Select
          value={sortValue}
          onChange={(next) => {
            setSortValue(next || DEFAULT_SORT);
            setPage(1);
          }}
          options={MEMBER_SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
          placeholder={currentSort.label}
        />
      </FilterBar>

      {error ? (
        <p className="form-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="admin-card admin-card--flush">
        <DataTable
          columns={columns}
          rows={list}
          loading={loading}
          rowKey="id"
          emptyText={hasFilter ? '没有匹配的会员，试试更换关键词' : '还没有注册会员'}
          emptyAction={
            hasFilter ? (
              <Button size="sm" variant="ghost" onClick={handleReset}>
                清空筛选
              </Button>
            ) : null
          }
          onRowClick={(row) => navigate(`/admin/members/${row.id}`)}
          sortBy={currentSort.sortBy}
          sortOrder={currentSort.order}
          onSort={handleSort}
        />
      </div>

      {total > PAGE_SIZE.ADMIN ? (
        <div className="a-page-foot">
          <Pagination page={page} pageSize={PAGE_SIZE.ADMIN} total={total} onChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

export default MemberList;
