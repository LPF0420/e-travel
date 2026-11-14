/**
 * P-17 地区列表（F-30、F-33）
 *
 * 路由：/admin/regions
 * 接口：
 *   GET    /api/admin/regions?keyword&page&pageSize → { list:[{...region, scenicCount}], total, ... }
 *   DELETE /api/admin/regions/:id                  → 被景区引用时 code 3001（message 为完整中文）
 *
 * 删除交互（DESIGN 要求）：
 * 3001 的 message（「该地区下还有 N 个景区，请先处理」）**直接显示在弹窗内**并保留弹窗，
 * 不让它变成一闪而过的 Toast，避免管理员漏看。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FilterBar from '../../components/admin/FilterBar.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Input from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS, PAGE_SIZE } from '../../lib/constants.js';
import { ERROR_CODES, del, get } from '../../lib/api.js';
import { formatDateTime, truncate } from '../../lib/format.js';

/**
 * 地区列表页。
 * @returns {JSX.Element}
 */
export function RegionList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
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

  /**
   * 拉取地区列表。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(ADMIN_PATHS.REGIONS, {
        scope: 'admin',
        query: { keyword: query, page, pageSize: PAGE_SIZE.ADMIN },
      });
      setList(data && Array.isArray(data.list) ? data.list : []);
      setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setList([]);
      setTotal(0);
      setError((err && err.message) || '地区列表加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** 重置筛选 */
  const handleReset = () => {
    setKeyword('');
    setQuery('');
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
      await del(`${ADMIN_PATHS.REGIONS}/${target.id}`, { scope: 'admin' });
      showToast('地区已删除', 'success');
      setDeleting(false);
      setTarget(null);
      // 删除后若当前页空了，回退一页
      if (list.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setDeleting(false);
      if (err && (err.status === 401 || err.status === 403)) return;
      const message = (err && err.message) || '删除失败，请稍后重试';
      if (err && err.code === ERROR_CODES.REGION_IN_USE) {
        // 3001：后端 message 已是完整中文，原样留在弹窗内
        setDeleteError(message);
        return;
      }
      setDeleteError(message);
      showToast(message, 'error');
    }
  };

  const hasFilter = keyword !== '';

  const columns = [
    {
      key: 'coverImage',
      title: '封面',
      width: '90px',
      render: (row) =>
        row.coverImage ? (
          <img className="a-table__thumb" src={row.coverImage} alt={`${row.name || '地区'}封面`} loading="lazy" />
        ) : (
          <span className="a-table__thumb a-table__thumb--empty">无图</span>
        ),
    },
    {
      key: 'name',
      title: '地区名',
      render: (row) => (
        <>
          <span className="table__primary">{row.name || '—'}</span>
          <span className="table__secondary">{truncate(row.description || '暂无简介', 28)}</span>
        </>
      ),
    },
    {
      key: 'scenicCount',
      title: '景区数',
      width: '90px',
      align: 'right',
      render: (row) => (
        <span className="table__cell--num">{Number.isFinite(Number(row.scenicCount)) ? row.scenicCount : 0}</span>
      ),
    },
    { key: 'sortOrder', title: '排序值', width: '90px', align: 'right', render: (row) => row.sortOrder ?? 0 },
    {
      key: 'updatedAt',
      title: '更新时间',
      width: '160px',
      render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.updatedAt) || '—'}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      align: 'right',
      render: (row) => (
        <div className="a-row-actions">
          <Button size="sm" variant="text" onClick={() => navigate(`/admin/regions/${row.id}/edit`)}>
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
    <div className="a-region">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">地区管理</h1>
          <p className="admin-head__desc">共 {total} 个地区，排序值越大越靠前，首页推荐位取排序值前 6 个。</p>
        </div>
        <Button onClick={() => navigate('/admin/regions/new')}>新增地区</Button>
      </div>

      <FilterBar onReset={handleReset} showReset={hasFilter}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索地区名称或简介"
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
          emptyText={hasFilter ? '没有匹配的地区' : '还没有地区，先新增一个地区吧'}
          emptyAction={
            hasFilter ? (
              <Button size="sm" variant="ghost" onClick={handleReset}>
                清空筛选
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/admin/regions/new')}>
                新增地区
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
        title="删除该地区？"
        desc={
          <>
            <span>
              即将删除地区「{target ? target.name : ''}」，删除后不可恢复。
            </span>
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

      <p className="a-page-tip">
        提示：地区下仍有景区时无法删除，请先到<Link to="/admin/scenics">景区管理</Link>调整或删除对应景区。
      </p>
    </div>
  );
}

export default RegionList;
