/**
 * P-04 游记列表（PRD §5.1 P-04）
 *
 * 布局：页头 → 景区筛选下拉 + 结果数 → 2 列横向游记卡 → 分页。
 * 状态源：URL（?scenicId&page），筛选与翻页都写回 searchParams，刷新可还原。
 * 景区下拉选项来自前台公开接口 `GET /api/scenics?limit=100`（后台 options 接口前台不可用）。
 * 空态：「暂无游记，敬请期待」；加载：4 个骨架卡；失败：空态 + 重试。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import TravelCard from '../../components/site/TravelCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { get } from '../../lib/api.js';
import { PAGE_SIZE, ROUTES } from '../../lib/constants.js';

/** 景区下拉一次性取全量（上限 100，够覆盖种子与演示数据） */
const SCENIC_OPTION_LIMIT = 100;

/** 骨架卡数量（2 列 × 2 行） */
const SKELETON_COUNT = 4;

/**
 * 把接口返回取成 list。
 * @param {any} data
 * @returns {object[]}
 */
function toList(data) {
  return data && Array.isArray(data.list) ? data.list : [];
}

/**
 * 游记列表。
 * @returns {JSX.Element}
 */
export function TravelList() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const scenicId = searchParams.get('scenicId') || '';
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [scenicOptions, setScenicOptions] = useState([]);

  // 景区下拉选项
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    get('/scenics', { query: { limit: SCENIC_OPTION_LIMIT }, signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        setScenicOptions(
          toList(data).map((scenic) => ({ value: String(scenic.id), label: scenic.name })),
        );
      })
      .catch(() => {
        if (alive) setScenicOptions([]);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // 游记列表
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setError('');

    get('/travels', {
      query: { scenicId, page, pageSize: PAGE_SIZE.TRAVELS },
      signal: controller.signal,
    })
      .then((data) => {
        if (!alive) return;
        setList(toList(data));
        setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : 0);
      })
      .catch((err) => {
        if (!alive) return;
        setList([]);
        setTotal(0);
        setError((err && err.message) || '游记列表加载失败');
        showToast((err && err.message) || '游记列表加载失败', 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [scenicId, page, reloadKey, showToast]);

  /**
   * 改写 URL 参数。
   * @param {Record<string, string|null|undefined>} patch
   */
  const setQuery = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  /**
   * 切换景区筛选。
   * @param {string} nextScenicId
   */
  const handleScenicChange = (nextScenicId) => {
    setQuery({ scenicId: nextScenicId || null, page: null });
  };

  /**
   * 清除筛选。
   */
  const clearFilter = () => setSearchParams(new URLSearchParams());

  /**
   * 翻页。
   * @param {number} nextPage
   */
  const handlePageChange = (nextPage) => {
    setQuery({ page: nextPage <= 1 ? null : nextPage });
  };

  return (
    <div className="page">
      <div className="container">
        <nav className="breadcrumb" aria-label="面包屑">
          <Link className="breadcrumb__link" to={ROUTES.HOME}>
            首页
          </Link>
          <span className="breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb__current">游记</span>
        </nav>

        <header className="page-head">
          <h1 className="page-head__title">旅行游记</h1>
          <p className="page-head__sub">
            走过的人写下的顺序、耗时与取舍。选一处景区，看看别人是怎么走的。
          </p>
        </header>

        <div className="p-travel-toolbar">
          <label className="p-travel-filter" htmlFor="travel-scenic">
            <span className="p-travel-filter__label">按景区筛选</span>
            <Select
              id="travel-scenic"
              value={scenicId}
              onChange={handleScenicChange}
              options={scenicOptions}
              placeholder="全部景区"
            />
          </label>
          <span className="p-travel-count">
            共 <strong className="num">{total}</strong> 篇游记
          </span>
        </div>

        {loading ? (
          <div className="stack">
            <Skeleton variant="card" count={SKELETON_COUNT} />
          </div>
        ) : null}

        {!loading && error ? (
          <EmptyState
            art="map"
            title="游记列表加载失败"
            desc={error}
            actionText="重新加载"
            onAction={() => setReloadKey((prev) => prev + 1)}
          />
        ) : null}

        {!loading && !error && list.length === 0 ? (
          <EmptyState
            art="map"
            title="暂无游记，敬请期待"
            desc={scenicId ? '这处景区还没有人写下行程，换一处看看。' : '第一批作者正在把行程整理出来。'}
            actionText={scenicId ? '全部游记' : ''}
            onAction={scenicId ? clearFilter : undefined}
          />
        ) : null}

        {!loading && !error && list.length > 0 ? (
          <div className="grid grid--2 p-travel-grid">
            {list.map((travel) => (
              <TravelCard travel={travel} horizontal key={travel.id} />
            ))}
          </div>
        ) : null}

        {!loading && !error && total > PAGE_SIZE.TRAVELS ? (
          <div className="p-travel-pager">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE.TRAVELS}
              total={total}
              onChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TravelList;
