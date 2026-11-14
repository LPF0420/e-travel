/**
 * P-21 游记列表（F-39、F-42）
 *
 * 路由：/admin/travels
 * 接口：
 *   GET    /api/admin/options?type=scenics          → 景区筛选下拉（label + extra 地区名）
 *   GET    /api/admin/travels?keyword&scenicId&page&pageSize
 *   DELETE /api/admin/travels/:id
 *
 * 「前台预览」按 PRD 要求**新窗口**打开 /travels/:id（不打断后台当前操作）。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FilterBar from '../../components/admin/FilterBar.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Input from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS, PAGE_SIZE } from '../../lib/constants.js';
import { del, get } from '../../lib/api.js';
import { formatDateTime, truncate } from '../../lib/format.js';

/**
 * 游记列表页。
 * @returns {JSX.Element}
 */
export function TravelList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [scenicId, setScenicId] = useState('');
  const [page, setPage] = useState(1);

  const [scenicOptions, setScenicOptions] = useState([]);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // 关键词防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = keyword.trim();
      setQuery((prev) => (prev === next ? prev : next));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  // 景区下拉（只取一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await get(ADMIN_PATHS.OPTIONS, { scope: 'admin', query: { type: 'scenics' } });
        if (cancelled) return;
        const raw = Array.isArray(data && data.list) ? data.list : [];
        setScenicOptions(
          raw.map((item) => ({
            value: item.value,
            label: item.extra ? `${item.label}（${item.extra}）` : item.label,
          })),
        );
      } catch (err) {
        if (cancelled) return;
        setScenicOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 拉取游记列表。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(ADMIN_PATHS.TRAVELS, {
        scope: 'admin',
        query: { keyword: query, scenicId, page, pageSize: PAGE_SIZE.ADMIN },
      });
      setList(data && Array.isArray(data.list) ? data.list : []);
      setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setList([]);
      setTotal(0);
      setError((err && err.message) || '游记列表加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [query, scenicId, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** 重置筛选 */
  const handleReset = () => {
    setKeyword('');
    setQuery('');
    setScenicId('');
    setPage(1);
  };

  /**
   * 打开删除确认。
   * @param {object} row
   */
  const openDelete = (row) => {
    setTarget(row);
    setDeleteError('');
  };

  /** 关闭删除确认 */
  const closeDelete = () => {
    if (deleting) return;
    setTarget(null);
    setDeleteError('');
  };

  /**
   * 执行删除。
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await del(`${ADMIN_PATHS.TRAVELS}/${target.id}`, { scope: 'admin' });
      showToast('游记已删除', 'success');
      setDeleting(false);
      setTarget(null);
      if (list.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setDeleting(false);
      if (err && (err.status === 401 || err.status === 403)) return;
      setDeleteError((err && err.message) || '删除失败，请稍后重试');
    }
  };

  /**
   * 前台预览（新窗口）。
   * @param {number} id
   */
  const openPreview = (id) => {
    window.open(`/travels/${id}`, '_blank', 'noopener,noreferrer');
  };

  const hasFilter = keyword !== '' || scenicId !== '';

  const columns = [
    {
      key: 'coverImage',
      title: '封面',
      width: '90px',
      render: (row) =>
        row.coverImage ? (
          <img className="a-table__thumb" src={row.coverImage} alt={`${row.title || '游记'}封面`} loading="lazy" />
        ) : (
          <span className="a-table__thumb a-table__thumb--empty">无图</span>
        ),
    },
    {
      key: 'title',
      title: '标题',
      render: (row) => (
        <>
          <span className="table__primary">{row.title || '—'}</span>
          <span className="table__secondary">{truncate(row.content || '', 34)}</span>
        </>
      ),
    },
    { key: 'scenicName', title: '所属景区', width: '150px', render: (row) => row.scenicName || '—' },
    { key: 'authorName', title: '作者', width: '110px', render: (row) => row.authorName || '—' },
    {
      key: 'publishedAt',
      title: '发布时间',
      width: '150px',
      render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.publishedAt) || '—'}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: '200px',
      align: 'right',
      render: (row) => (
        <div className="a-row-actions">
          <Button size="sm" variant="text" onClick={() => openPreview(row.id)}>
            前台预览
          </Button>
          <Button size="sm" variant="text" onClick={() => navigate(`/admin/travels/${row.id}/edit`)}>
            编辑
          </Button>
          <Button size="sm" variant="text" className="a-btn-danger" onClick={() => openDelete(row)}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="a-travel">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">游记管理</h1>
          <p className="admin-head__desc">共 {total} 篇游记，可代会员发布运营精选游记。</p>
        </div>
        <Button onClick={() => navigate('/admin/travels/new')}>新增游记</Button>
      </div>

      <FilterBar onReset={handleReset} showReset={hasFilter}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索游记标题或作者"
        />
        <Select
          value={scenicId}
          onChange={(next) => {
            setScenicId(next);
            setPage(1);
          }}
          options={scenicOptions}
          placeholder="全部景区"
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
          emptyText={hasFilter ? '没有符合条件的游记' : '还没有游记，先发布一篇吧'}
          emptyAction={
            hasFilter ? (
              <Button size="sm" variant="ghost" onClick={handleReset}>
                清空筛选
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/admin/travels/new')}>
                新增游记
              </Button>
            )
          }
        />
      </div>

      {total > PAGE_SIZE.ADMIN ? (
        <div className="a-page-foot">
          <Pagination page={page} pageSize={PAGE_SIZE.ADMIN} total={total} onChange={setPage} />
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(target)}
        title="删除该游记？"
        desc={
          <>
            <span>即将删除游记「{target ? target.title : ''}」，删除后不可恢复。</span>
            {deleteError ? (
              <span className="form-alert a-dialog__error" role="alert">
                {deleteError}
              </span>
            ) : null}
          </>
        }
        danger
        confirmText={deleting ? '删除中…' : '确认删除'}
        loading={deleting}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </div>
  );
}

export default TravelList;
