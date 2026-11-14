/**
 * P-01 首页（PRD §5.1 P-01 / DESIGN §6.2）
 *
 * 结构：HeroSearch（首屏，Navbar 透明态由 SiteLayout 负责）→ 数字条
 *       →「为什么在这里看攻略」三点价值 → 推荐景区（3 列）→ 推荐地区（3 列）
 *       → 最新游记（3 列）→ 页脚（SiteLayout）
 *
 * 数据：/scenics?isRecommended=true&limit=6、/regions?limit=6、/travels?limit=3、/stats/public
 * 四个请求互不阻塞（Promise.allSettled）：任一失败只把该区块降级为空态 + 顶部 Toast，
 * 绝不整页白屏（PRD 空态/错误态要求）。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import HeroSearch from '../../components/site/HeroSearch.jsx';
import RegionCard from '../../components/site/RegionCard.jsx';
import ScenicCard from '../../components/site/ScenicCard.jsx';
import SectionHeader from '../../components/site/SectionHeader.jsx';
import TravelCard from '../../components/site/TravelCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Skeleton, SkeletonGrid } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { get } from '../../lib/api.js';
import { LIMITS, ROUTES, STATS_PATH } from '../../lib/constants.js';

/** 首页 Hero 文案（有旅行感，不写空话） */
const HERO_TITLE = '把假期，交给风景';
const HERO_SUBTITLE =
  '从一处山水的来历，到一条能走通的路线。景区介绍与旅行攻略，都在这里慢慢写。';

/** 数字条（三项，值来自 /stats/public） */
const STAT_ITEMS = [
  { key: 'regionCount', label: '个地区' },
  { key: 'scenicCount', label: '个景区' },
  { key: 'travelCount', label: '篇游记' },
];

/** 「为什么在这里看攻略」三点价值（纯文案 + 内联 SVG 图标） */
const VALUES = [
  {
    key: 'geo',
    title: '先讲清楚地方，再谈行程',
    desc: '每篇景区介绍都从地形、气候与季节讲起，让你知道为什么值得去、什么时候去。',
    icon: 'map',
  },
  {
    key: 'route',
    title: '攻略是可以照着走的',
    desc: '游记里有具体的顺序、耗时与绕行理由，不是一句「建议早点出发」。',
    icon: 'route',
  },
  {
    key: 'keep',
    title: '把想去的地方收起来',
    desc: '登录后可以把景区加入收藏，放假前翻一遍，就是一份现成的备选清单。',
    icon: 'star',
  },
];

/**
 * 空区块状态构造器。
 * @returns {{ loading: boolean, error: string, list: object[] }}
 */
function emptySection() {
  return { loading: true, error: '', list: [] };
}

/**
 * 价值点图标。
 * @param {{ name: string }} props
 * @returns {JSX.Element}
 */
function ValueIcon({ name }) {
  if (name === 'route') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="6" r="2.4" />
        <circle cx="18" cy="18" r="2.4" />
        <path d="M6 8.4v4.2a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3" />
      </svg>
    );
  }
  if (name === 'star') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  );
}

/**
 * 首页。
 * @returns {JSX.Element}
 */
export function Home() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [scenics, setScenics] = useState(emptySection);
  const [regions, setRegions] = useState(emptySection);
  const [travels, setTravels] = useState(emptySection);
  const [stats, setStats] = useState({ loading: true, error: '', value: null });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let alive = true;

    setScenics(emptySection());
    setRegions(emptySection());
    setTravels(emptySection());
    setStats({ loading: true, error: '', value: null });

    /**
     * 把接口返回统一取成 list（分页包与 { list, total } 两种都兼容）。
     * @param {any} data
     * @returns {object[]}
     */
    const toList = (data) => (data && Array.isArray(data.list) ? data.list : []);

    Promise.allSettled([
      get('/scenics', { query: { isRecommended: true, limit: LIMITS.HOME_SCENICS }, signal }),
      get('/regions', { query: { limit: LIMITS.HOME_REGIONS }, signal }),
      get('/travels', { query: { limit: LIMITS.HOME_TRAVELS }, signal }),
      get(STATS_PATH, { signal }),
    ]).then((results) => {
      if (!alive) return;
      const [scenicRes, regionRes, travelRes, statsRes] = results;

      setScenics(
        scenicRes.status === 'fulfilled'
          ? { loading: false, error: '', list: toList(scenicRes.value) }
          : { loading: false, error: '推荐景区加载失败', list: [] },
      );
      setRegions(
        regionRes.status === 'fulfilled'
          ? { loading: false, error: '', list: toList(regionRes.value) }
          : { loading: false, error: '推荐地区加载失败', list: [] },
      );
      setTravels(
        travelRes.status === 'fulfilled'
          ? { loading: false, error: '', list: toList(travelRes.value) }
          : { loading: false, error: '最新游记加载失败', list: [] },
      );
      setStats(
        statsRes.status === 'fulfilled'
          ? { loading: false, error: '', value: statsRes.value || null }
          : { loading: false, error: '统计加载失败', value: null },
      );

      const failedCount = results.filter((item) => item.status === 'rejected').length;
      if (failedCount > 0) {
        showToast('部分内容暂时加载失败，可点击对应区块重新加载', 'error');
      }
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [reloadKey, showToast]);

  /**
   * 搜索：截断到 50 字后进 URL（后端 header 限制会打成 431）。
   * @param {string} value
   */
  const handleSearch = (value) => {
    const text = String(value || '').trim().slice(0, 50);
    if (!text) return;
    navigate(`${ROUTES.SCENIC_LIST}?keyword=${encodeURIComponent(text)}`);
  };

  /**
   * 重新加载全部区块。
   */
  const reload = () => setReloadKey((prev) => prev + 1);

  /**
   * 统计数字（加载中或失败给「—」）。
   * @param {string} key
   * @returns {string}
   */
  const statValue = (key) => {
    if (!stats.value) return '—';
    const num = Number(stats.value[key]);
    return Number.isFinite(num) ? String(num) : '—';
  };

  return (
    <div className="p-home">
      <HeroSearch title={HERO_TITLE} subtitle={HERO_SUBTITLE} onSearch={handleSearch} />

      <div className="container">
        <div className="p-home-stats" role="list">
          {STAT_ITEMS.map((item) => (
            <div className="p-home-stat" role="listitem" key={item.key}>
              <span className="p-home-stat__num num">{statValue(item.key)}</span>
              <span className="p-home-stat__label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="section section--flush-top">
        <div className="container">
          <SectionHeader
            title="为什么在这里看攻略"
            desc="不做排行榜，只把地方讲清楚，把路写明白。"
          />
          <div className="grid grid--3 p-home-values">
            {VALUES.map((item) => (
              <article className="p-home-value" key={item.key}>
                <span className="p-home-value__icon" aria-hidden="true">
                  <ValueIcon name={item.icon} />
                </span>
                <h3 className="p-home-value__title">{item.title}</h3>
                <p className="p-home-value__desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--flush-top">
        <div className="container">
          <SectionHeader
            title="推荐景区"
            desc="编辑挑出的六处，季节与路况都刚合适。"
            moreTo={ROUTES.SCENIC_LIST}
          />
          {scenics.loading ? <SkeletonGrid count={LIMITS.HOME_SCENICS} /> : null}
          {!scenics.loading && scenics.error ? (
            <EmptyState
              art="mountain"
              title={scenics.error}
              desc="后端服务可能刚启动，稍后再试一次。"
              actionText="重新加载"
              onAction={reload}
            />
          ) : null}
          {!scenics.loading && !scenics.error && scenics.list.length === 0 ? (
            <EmptyState art="mountain" title="暂无推荐，内容正在补充中" desc="编辑正在挑选下一批景区。" />
          ) : null}
          {!scenics.loading && !scenics.error && scenics.list.length > 0 ? (
            <div className="grid grid--3">
              {scenics.list.map((scenic) => (
                <ScenicCard scenic={scenic} key={scenic.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section--flush-top">
        <div className="container">
          <SectionHeader
            title="推荐地区"
            desc="按地理区域整理，先选一片山，再挑一处景。"
            moreTo={ROUTES.SCENIC_LIST}
          />
          {regions.loading ? <SkeletonGrid count={LIMITS.HOME_REGIONS} /> : null}
          {!regions.loading && regions.error ? (
            <EmptyState
              art="map"
              title={regions.error}
              desc="地区数据没有取到，可以稍后刷新。"
              actionText="重新加载"
              onAction={reload}
            />
          ) : null}
          {!regions.loading && !regions.error && regions.list.length === 0 ? (
            <EmptyState art="map" title="暂无推荐地区，内容正在补充中" />
          ) : null}
          {!regions.loading && !regions.error && regions.list.length > 0 ? (
            <div className="grid grid--3">
              {regions.list.map((region) => (
                <RegionCard region={region} key={region.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section section--flush-top">
        <div className="container">
          <SectionHeader
            title="最新游记"
            desc="走过的人写下的路线、取舍与绕行。"
            moreTo={ROUTES.TRAVEL_LIST}
          />
          {travels.loading ? (
            <div className="stack">
              <Skeleton variant="card" count={3} />
            </div>
          ) : null}
          {!travels.loading && travels.error ? (
            <EmptyState
              art="map"
              title={travels.error}
              desc="游记列表没有取到，可以稍后刷新。"
              actionText="重新加载"
              onAction={reload}
            />
          ) : null}
          {!travels.loading && !travels.error && travels.list.length === 0 ? (
            <EmptyState art="map" title="还没有发布的游记" desc="等第一批作者把行程写下来。" />
          ) : null}
          {!travels.loading && !travels.error && travels.list.length > 0 ? (
            <div className="grid grid--3">
              {travels.list.map((travel) => (
                <TravelCard travel={travel} key={travel.id} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default Home;
