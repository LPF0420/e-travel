/**
 * P-23 日志管理（F-43、F-45、F-46）
 *
 * 路由：/admin/logs（支持 ?tab=operation|admin|memberLogin 深链）
 * 接口（三条**独立路径**，不是 /logs?type=）：
 *   GET /api/admin/logs/operations?module&action&result&startDate&endDate&page&pageSize
 *   GET /api/admin/logs/admins?event&startDate&endDate&page&pageSize
 *   GET /api/admin/logs/member-logins?result&keyword&startDate&endDate&page&pageSize
 *   pageSize 上限 100，后台日志默认 PAGE_SIZE.LOGS = 20。
 *
 * 状态设计：三个 Tab **各自**保存筛选条件与页码（filters 以 tab key 为索引），
 * 切换 Tab 时只把目标 Tab 的页码重置为 1，不动其它 Tab 的条件。
 * 筛选字段严格按后端支持的能力给：操作日志无 keyword；管理员日志无 keyword；会员登录日志有 keyword。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import FilterBar from '../../components/admin/FilterBar.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Input from '../../components/ui/Input.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import Tag from '../../components/ui/Tag.jsx';
import {
  ADMIN_LOG_EVENT_LABELS,
  LOG_ACTION_LABELS,
  LOG_MODULE_LABELS,
  LOG_RESULT_LABELS,
  LOG_TABS,
  PAGE_SIZE,
} from '../../lib/constants.js';
import { get } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

/** 模块筛选下拉（第一项为空 = 全部） */
const MODULE_OPTIONS = Object.keys(LOG_MODULE_LABELS).map((key) => ({ value: key, label: LOG_MODULE_LABELS[key] }));
/** 动作筛选下拉 */
const ACTION_OPTIONS = Object.keys(LOG_ACTION_LABELS).map((key) => ({ value: key, label: LOG_ACTION_LABELS[key] }));
/** 结果筛选下拉 */
const RESULT_OPTIONS = Object.keys(LOG_RESULT_LABELS).map((key) => ({ value: key, label: LOG_RESULT_LABELS[key] }));
/** 管理员事件下拉 */
const EVENT_OPTIONS = Object.keys(ADMIN_LOG_EVENT_LABELS).map((key) => ({
  value: key,
  label: ADMIN_LOG_EVENT_LABELS[key],
}));

/** 单个 Tab 的筛选初值 */
function emptyFilter() {
  return {
    page: 1,
    keyword: '',
    module: '',
    action: '',
    result: '',
    event: '',
    startDate: '',
    endDate: '',
  };
}

/** 三个 Tab 的独立筛选状态 */
function buildInitialFilters() {
  const state = {};
  LOG_TABS.forEach((tab) => {
    state[tab.key] = emptyFilter();
  });
  return state;
}

/**
 * 结果列渲染。
 * @param {string} result
 * @returns {JSX.Element}
 */
function renderResult(result) {
  const ok = result === 'success';
  return (
    <Tag variant={ok ? 'resolved' : 'pending'} size="sm">
      {LOG_RESULT_LABELS[result] || result || '—'}
    </Tag>
  );
}

/**
 * 日志管理页。
 * @returns {JSX.Element}
 */
export function LogList() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab 以 URL 为唯一真相源：深链读取 /admin/logs?tab=memberLogin 时无需额外同步
  const tabParam = searchParams.get('tab') || '';
  const tab = LOG_TABS.some((item) => item.key === tabParam) ? tabParam : LOG_TABS[0].key;
  const [filters, setFilters] = useState(buildInitialFilters);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const current = filters[tab] || emptyFilter();
  const activeTab = LOG_TABS.find((item) => item.key === tab) || LOG_TABS[0];

  /**
   * 更新当前 Tab 的筛选（默认回到第一页）。
   * @param {object} patch
   * @param {boolean} [resetPage=true]
   */
  const updateCurrent = (patch, resetPage = true) => {
    setFilters((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...patch,
        page: resetPage ? 1 : (patch.page || prev[tab].page),
      },
    }));
  };

  /**
   * 切换页码（只影响当前 Tab）。
   * @param {number} nextPage
   */
  const updatePage = (nextPage) => {
    setFilters((prev) => ({ ...prev, [tab]: { ...prev[tab], page: nextPage } }));
  };

  /** 重置当前 Tab 筛选 */
  const handleReset = () => {
    setFilters((prev) => ({ ...prev, [tab]: emptyFilter() }));
  };

  /**
   * 切换 Tab：同步 URL，并把目标 Tab 的页码重置为 1。
   * @param {string} nextTab
   */
  const handleTabChange = (nextTab) => {
    if (nextTab === tab) return;
    setFilters((prev) => ({ ...prev, [nextTab]: { ...prev[nextTab], page: 1 } }));
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  /**
   * 拉取当前 Tab 的日志。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    const state = filters[tab] || emptyFilter();
    let query = { page: state.page, pageSize: PAGE_SIZE.LOGS };
    if (tab === 'operation') {
      query = {
        ...query,
        module: state.module,
        action: state.action,
        result: state.result,
        startDate: state.startDate,
        endDate: state.endDate,
      };
    } else if (tab === 'admin') {
      query = { ...query, event: state.event, startDate: state.startDate, endDate: state.endDate };
    } else {
      query = {
        ...query,
        keyword: state.keyword.trim(),
        result: state.result,
        startDate: state.startDate,
        endDate: state.endDate,
      };
    }

    setLoading(true);
    setError('');
    try {
      const data = await get(activeTab.api, { scope: 'admin', query });
      setList(data && Array.isArray(data.list) ? data.list : []);
      setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setList([]);
      setTotal(0);
      setError((err && err.message) || '日志加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeTab.api, filters, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const operationColumns = useMemo(
    () => [
      {
        key: 'createdAt',
        title: '时间',
        width: '160px',
        render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.createdAt) || '—'}</span>,
      },
      { key: 'adminName', title: '管理员', width: '120px', render: (row) => row.adminName || '—' },
      {
        key: 'module',
        title: '模块',
        width: '90px',
        render: (row) => <Tag variant="region" size="sm">{LOG_MODULE_LABELS[row.module] || row.module || '—'}</Tag>,
      },
      {
        key: 'action',
        title: '动作',
        width: '80px',
        render: (row) => LOG_ACTION_LABELS[row.action] || row.action || '—',
      },
      { key: 'targetName', title: '目标', render: (row) => row.targetName || '—' },
      { key: 'result', title: '结果', width: '80px', render: (row) => renderResult(row.result) },
      { key: 'message', title: '说明', render: (row) => row.message || '—' },
      { key: 'ip', title: 'IP', width: '130px', render: (row) => row.ip || '—' },
    ],
    [],
  );

  const adminColumns = useMemo(
    () => [
      {
        key: 'createdAt',
        title: '时间',
        width: '160px',
        render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.createdAt) || '—'}</span>,
      },
      { key: 'username', title: '管理员账号', width: '150px', render: (row) => row.username || '—' },
      {
        key: 'event',
        title: '事件',
        width: '120px',
        render: (row) => ADMIN_LOG_EVENT_LABELS[row.event] || row.event || '—',
      },
      { key: 'result', title: '结果', width: '80px', render: (row) => renderResult(row.result) },
      { key: 'message', title: '说明', render: (row) => row.message || '—' },
      { key: 'ip', title: 'IP', width: '130px', render: (row) => row.ip || '—' },
    ],
    [],
  );

  const memberLoginColumns = useMemo(
    () => [
      {
        key: 'createdAt',
        title: '时间',
        width: '160px',
        render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.createdAt) || '—'}</span>,
      },
      { key: 'username', title: '会员名', width: '150px', render: (row) => row.username || '—' },
      { key: 'result', title: '结果', width: '80px', render: (row) => renderResult(row.result) },
      { key: 'message', title: '说明', render: (row) => row.message || '—' },
      { key: 'ip', title: 'IP', width: '130px', render: (row) => row.ip || '—' },
    ],
    [],
  );

  const columns = tab === 'operation' ? operationColumns : tab === 'admin' ? adminColumns : memberLoginColumns;

  const emptyText =
    tab === 'operation' ? '没有符合条件的操作日志' : tab === 'admin' ? '没有符合条件的管理员日志' : '没有符合条件的会员登录日志';

  const hasFilter =
    current.keyword !== '' ||
    current.module !== '' ||
    current.action !== '' ||
    current.result !== '' ||
    current.event !== '' ||
    current.startDate !== '' ||
    current.endDate !== '';

  return (
    <div className="a-log">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">日志管理</h1>
          <p className="admin-head__desc">
            操作日志记录内容变更，管理员与会员登录日志记录登录行为；共 {total} 条{activeTab.label}。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>
          刷新
        </Button>
      </div>

      <div className="tabs" role="tablist" aria-label="日志类型">
        {LOG_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === tab}
            className={`tabs__item${item.key === tab ? ' is-active' : ''}`}
            onClick={() => handleTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <FilterBar onReset={handleReset} showReset={hasFilter}>
        {tab === 'operation' ? (
          <>
            <Select
              value={current.module}
              onChange={(next) => updateCurrent({ module: next })}
              options={MODULE_OPTIONS}
              placeholder="全部模块"
            />
            <Select
              value={current.action}
              onChange={(next) => updateCurrent({ action: next })}
              options={ACTION_OPTIONS}
              placeholder="全部动作"
            />
          </>
        ) : null}

        {tab === 'admin' ? (
          <Select
            value={current.event}
            onChange={(next) => updateCurrent({ event: next })}
            options={EVENT_OPTIONS}
            placeholder="全部事件"
          />
        ) : null}

        {tab === 'memberLogin' ? (
          <Input
            value={current.keyword}
            onChange={(event) => updateCurrent({ keyword: event.target.value })}
            placeholder="搜索会员名"
          />
        ) : null}

        {tab !== 'admin' ? (
          <Select
            value={current.result}
            onChange={(next) => updateCurrent({ result: next })}
            options={RESULT_OPTIONS}
            placeholder="全部结果"
          />
        ) : null}

        <Input
          type="date"
          value={current.startDate}
          onChange={(event) => updateCurrent({ startDate: event.target.value })}
          aria-label="开始日期"
        />
        <Input
          type="date"
          value={current.endDate}
          onChange={(event) => updateCurrent({ endDate: event.target.value })}
          aria-label="结束日期"
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
          emptyText={emptyText}
          emptyAction={
            hasFilter ? (
              <Button size="sm" variant="ghost" onClick={handleReset}>
                清空筛选
              </Button>
            ) : null
          }
        />
      </div>

      {total > PAGE_SIZE.LOGS ? (
        <div className="a-page-foot">
          <Pagination page={current.page} pageSize={PAGE_SIZE.LOGS} total={total} onChange={updatePage} />
        </div>
      ) : null}
    </div>
  );
}

export default LogList;
