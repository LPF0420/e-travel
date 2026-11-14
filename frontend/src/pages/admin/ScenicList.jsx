/**
 * P-19 景区列表（F-34、F-38、F-36）
 *
 * 路由：/admin/scenics
 * 接口：
 *   GET    /api/admin/options?type=regions                       → 地区下拉
 *   GET    /api/admin/scenics?keyword&regionId&page&pageSize          → 列表（筛选：关键词 + 地区）
 *   PATCH  /api/admin/scenics/:id/recommend { isRecommended }    → 由 RecommendSwitch 内部调用
 *   DELETE /api/admin/scenics/:id                                → 级联删除游记与收藏
 *
 * 删除弹窗文案必须写明级联后果（DESIGN §6.2）：用行数据 travelCount / favoriteCount 填数字，
 * 取不到时退化为「相关游记与收藏」。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FilterBar from '../../components/admin/FilterBar.jsx';
import RecommendSwitch from '../../components/admin/RecommendSwitch.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Input from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import Tag from '../../components/ui/Tag.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS, PAGE_SIZE } from '../../lib/constants.js';
import { del, get } from '../../lib/api.js';
import { formatDateTime, formatRating, truncate } from '../../lib/format.js';

/**
 * 景区列表页。
 * @returns {JSX.Element}
 */
export function ScenicList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [regionId, setRegionId] = useState('');
  const [page, setPage] = useState(1);

  const [regionOptions, setRegionOptions] = useState([]);
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

  // 地区下拉（只取一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await get(ADMIN_PATHS.OPTIONS, { scope: 'admin', query: { type: 'regions' } });
        if (cancelled) return;
        setRegionOptions(Array.isArray(data && data.list) ? data.list : []);
      } catch (err) {
        if (cancelled) return;
        setRegionOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 拉取景区列表。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(ADMIN_PATHS.SCENICS, {
        scope: 'admin',
        query: {
          keyword: query,
          regionId,
          page,
          pageSize: PAGE_SIZE.ADMIN,
        },
      });
      setList(data && Array.isArray(data.list) ? data.list : []);
      setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setList([]);
      setTotal(0);
      setError((err && err.message) || '景区列表加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [query, regionId, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** 重置筛选 */
  const handleReset = () => {
    setKeyword('');
    setQuery('');
    setRegionId('');
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
   * 执行删除（级联）。
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const data = await del(`${ADMIN_PATHS.SCENICS}/${target.id}`, { scope: 'admin' });
      const cascade = data && data.cascade ? data.cascade : null;
      const extra = cascade ? `（同时删除 ${cascade.travels} 篇游记、${cascade.favorites} 条收藏）` : '';
      showToast(`景区已删除${extra}`, 'success');
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
   * 推荐开关回调：同步行内状态。
   * @param {number} id
   * @param {boolean} next
   */
  const handleRecommendChanged = (id, next) => {
    setList((prev) => prev.map((row) => (row.id === id ? { ...row, isRecommended: next } : row)));
  };

  const hasFilter = keyword !== '' || regionId !== '';

  /**
   * 删除弹窗文案（级联数量优先取行数据）。
   * @param {object|null} row
   * @returns {string}
   */
  const buildDeleteDesc = (row) => {
    if (!row) return '';
    const travelCount = Number.isFinite(Number(row.travelCount)) ? Number(row.travelCount) : null;
    const favoriteCount = Number.isFinite(Number(row.favoriteCount)) ? Number(row.favoriteCount) : null;
    const cascadeText =
      travelCount !== null && favoriteCount !== null
        ? `将同时删除该景区下 ${travelCount} 篇游记与 ${favoriteCount} 条收藏`
        : '将同时删除该景区下相关游记与收藏';
    return `即将删除景区「${row.name || ''}」，${cascadeText}，且不可恢复。`;
  };

  const columns = [
    {
      key: 'coverImage',
      title: '封面',
      width: '90px',
      render: (row) =>
        row.coverImage ? (
          <img className="a-table__thumb" src={row.coverImage} alt={`${row.name || '景区'}封面`} loading="lazy" />
        ) : (
          <span className="a-table__thumb a-table__thumb--empty">无图</span>
        ),
    },
    {
      key: 'name',
      title: '景区名',
      render: (row) => (
        <>
          <span className="table__primary">{row.name || '—'}</span>
          <span className="table__secondary">{truncate(row.description || '暂无简介', 26)}</span>
        </>
      ),
    },
    { key: 'regionName', title: '地区', width: '120px', render: (row) => row.regionName || '—' },
    {
      key: 'level',
      title: '等级',
      width: '80px',
      render: (row) => (row.level ? <Tag variant="level">{row.level}</Tag> : <span className="a-cell-muted">未评级</span>),
    },
    { key: 'rating', title: '评分', width: '80px', align: 'right', render: (row) => formatRating(row.rating) },
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
      key: 'isRecommended',
      title: '推荐',
      width: '110px',
      render: (row) => (
        <RecommendSwitch
          scenicId={row.id}
          value={Boolean(row.isRecommended)}
          onChanged={(next) => handleRecommendChanged(row.id, next)}
        />
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      width: '150px',
      render: (row) => <span className="table__cell--nowrap">{formatDateTime(row.updatedAt) || '—'}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      align: 'right',
      render: (row) => (
        <div className="a-row-actions">
          <Button size="sm" variant="text" onClick={() => navigate(`/admin/scenics/${row.id}/edit`)}>
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
    <div className="a-scenic">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">景区管理</h1>
          <p className="admin-head__desc">共 {total} 个景区，推荐景区会出现在前台首页与「推荐」排序优先位。</p>
        </div>
        <Button onClick={() => navigate('/admin/scenics/new')}>新增景区</Button>
      </div>

      {/* 关键词 + 地区两件筛选：搜索框吃满剩余宽度，地区下拉固定 200px（见 .filter-bar__fields 规则） */}
      <FilterBar onReset={handleReset} showReset={hasFilter}>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索景区名称或简介"
        />
        <Select
          value={regionId}
          onChange={(next) => {
            setRegionId(next);
            setPage(1);
          }}
          options={regionOptions}
          placeholder="全部地区"
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
          emptyText={hasFilter ? '没有符合条件的景区' : '还没有景区，先新增一个景区吧'}
          emptyAction={
            hasFilter ? (
              <Button size="sm" variant="ghost" onClick={handleReset}>
                清空筛选
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate('/admin/scenics/new')}>
                新增景区
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
        title="删除该景区？"
        desc={
          <>
            <span>{buildDeleteDesc(target)}</span>
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

export default ScenicList;
