/**
 * P-02 景区列表 / 搜索结果（PRD §5.1 P-02）
 *
 * 状态源：**URL 是唯一状态源**（?keyword&regionId&sort&page），
 * 任何筛选变化都写回 searchParams，返回 / 刷新 / 分享链接都能还原同一屏结果。
 *
 * 布局：面包屑 → 结果标题区 → 左筛选侧栏（≤1024px 自动转顶部 chips）+ 右 3 列网格 → 分页。
 * 空态：EmptyState(art='search') + 清除筛选；加载：9 个骨架卡；失败：空态 + 重试。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import FilterSidebar from '../../components/site/FilterSidebar.jsx';
import ScenicCard from '../../components/site/ScenicCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Select from '../../components/ui/Select.jsx';
import { SkeletonGrid } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { get } from '../../lib/api.js';
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  ROUTES,
  SORT_OPTIONS,
} from '../../lib/constants.js';

/** 关键词最大长度（后端 header 体积限制，超长会打成 431） */
const KEYWORD_MAX = 50;

/** 一次性拉全量景区做下拉（仅用于游记页的景区筛选，此处取地区用 limit 上限内的值） */
const REGION_FETCH_LIMIT = 100;

/**
 * 把接口返回取成 list（分页包与 { list, total } 两种都兼容）。
 * @param {any} data
 * @returns {object[]}
 */
function toList(data) {
  return data && Array.isArray(data.list) ? data.list : [];
}

/**
 * 景区列表 / 搜索结果。
 * @returns {JSX.Element}
 */
export function ScenicList() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawKeyword = searchParams.get('keyword') || '';
  const keyword = rawKeyword.slice(0, KEYWORD_MAX);
  const regionId = searchParams.get('regionId') || '';
  const rawSort = searchParams.get('sort') || '';
  const sort = SORT_OPTIONS.some((item) => item.value === rawSort) ? rawSort : DEFAULT_SORT;
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [regionList, setRegionList] = useState([]);

  // 地区侧栏：只在首屏取一次（地区数量小且稳定）
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    get('/regions', { query: { limit: REGION_FETCH_LIMIT }, signal: controller.signal })
      .then((data) => {
        if (alive) setRegionList(toList(data));
      })
      .catch(() => {
        if (alive) setRegionList([]);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // 结果列表：完全由 URL 参数驱动
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setError('');

    get('/scenics', {
      query: {
        keyword,
        regionId,
        sort,
        page,
        pageSize: PAGE_SIZE.SCENICS,
      },
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
        setError((err && err.message) || '景区列表加载失败');
        showToast((err && err.message) || '景区列表加载失败', 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [keyword, regionId, sort, page, reloadKey, showToast]);

  /**
   * 改写 URL 参数（空值即删除；筛选变化时把 page 重置掉）。
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
   * 切换地区（null 表示全部）。
   * @param {string|null} nextRegionId
   */
  const handleRegionChange = (nextRegionId) => {
    setQuery({ regionId: nextRegionId || null, page: null });
  };

  /**
   * 切换排序。
   * @param {string} nextSort
   */
  const handleSortChange = (nextSort) => {
    setQuery({ sort: nextSort === DEFAULT_SORT ? null : nextSort, page: null });
  };

  /**
   * 清除关键词。
   */
  const clearKeyword = () => {
    setQuery({ keyword: null, page: null });
  };

  /**
   * 清除全部筛选（保留排序以外的都清掉）。
   */
  const clearAll = () => {
    setSearchParams(new URLSearchParams());
  };

  /**
   * 翻页（只改 page，保留其它筛选）。
   * @param {number} nextPage
   */
  const handlePageChange = (nextPage) => {
    setQuery({ page: nextPage <= 1 ? null : nextPage });
  };

  const hasFilter = Boolean(keyword) || Boolean(regionId);
  const title = keyword ? `搜索：${keyword}` : regionId ? '按地区浏览' : '全部景区';
  const subtitle = keyword
    ? '关键词同时匹配景区名称、简介与景区看点。'
    : '从高原湖泊到海岸沙滩，按地区横向比较。';

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
          <span className="breadcrumb__current">景区</span>
        </nav>

        <header className="page-head">
          <h1 className="page-head__title">{title}</h1>
          <p className="page-head__sub">{subtitle}</p>
        </header>

        <div className="p-scenic-toolbar">
          <div className="p-scenic-toolbar__left">
            {keyword ? (
              <span className="p-scenic-keyword">
                <span className="p-scenic-keyword__text">{keyword}</span>
                <button
                  type="button"
                  className="p-scenic-keyword__clear"
                  onClick={clearKeyword}
                  aria-label={`清除关键词 ${keyword}`}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                  </svg>
                </button>
              </span>
            ) : null}
            <span className="p-scenic-count">
              共 <strong className="num">{total}</strong> 个景区
            </span>
          </div>

          <div className="p-scenic-toolbar__right">
            <label className="p-scenic-sort" htmlFor="scenic-sort">
              <span className="p-scenic-sort__label">排序</span>
              <Select
                id="scenic-sort"
                value={sort}
                onChange={handleSortChange}
                options={SORT_OPTIONS}
                placeholder="综合推荐"
              />
            </label>
          </div>
        </div>

        <div className="list-layout p-scenic-layout">
          <aside className="list-layout__aside">
            <FilterSidebar
              regions={regionList}
              regionId={regionId}
              onChange={handleRegionChange}
              total={total}
            />
          </aside>

          <div className="list-layout__results">
            {loading ? <SkeletonGrid count={PAGE_SIZE.SCENICS} /> : null}

            {!loading && error ? (
              <EmptyState
                art="mountain"
                title="景区列表加载失败"
                desc={error}
                actionText="重新加载"
                onAction={() => setReloadKey((prev) => prev + 1)}
              />
            ) : null}

            {!loading && !error && list.length === 0 ? (
              <EmptyState
                art="search"
                title="没有找到相关景区"
                desc={hasFilter ? '试试更换关键词，或者清空筛选条件重新看一遍。' : '还没有可展示的景区。'}
                actionText={hasFilter ? '清除筛选' : ''}
                onAction={hasFilter ? clearAll : undefined}
              />
            ) : null}

            {!loading && !error && list.length > 0 ? (
              <div className="grid grid--3">
                {list.map((scenic) => (
                  <ScenicCard scenic={scenic} key={scenic.id} />
                ))}
              </div>
            ) : null}

            {!loading && !error && total > PAGE_SIZE.SCENICS ? (
              <div className="p-scenic-pager">
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE.SCENICS}
                  total={total}
                  onChange={handlePageChange}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScenicList;
