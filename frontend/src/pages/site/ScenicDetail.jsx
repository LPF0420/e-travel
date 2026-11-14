/**
 * P-03 景区详情（PRD §5.1 P-03）
 *
 * 数据：GET /api/scenics/:id → { scenic, region }
 *       GET /api/scenics?regionId=…（同地区其它景区，用于图集补充 + 侧栏）
 *       GET /api/scenics/:id/travels?limit=5（关联游记）
 *
 * 结构：面包屑 → 图集（1 主 2 副）→ 标题区（地区/等级标签 + 评分 + 收藏数 + 收藏按钮）
 *       → InfoBar（字段缺失整列隐藏）→ 两栏（简介 + 看点 ／ 地区卡 + 同地区景区）
 *       → 关联游记 → 页脚。
 *
 * 空态 / 错误态：code 1002 → 页内 404 区块；无游记 → 区块内空态；加载 → 骨架。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ArticleBody from '../../components/site/ArticleBody.jsx';
import FavoriteButton from '../../components/site/FavoriteButton.jsx';
import ImageGallery from '../../components/site/ImageGallery.jsx';
import InfoBar from '../../components/site/InfoBar.jsx';
import RegionCard from '../../components/site/RegionCard.jsx';
import TravelCard from '../../components/site/TravelCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import Tag from '../../components/ui/Tag.jsx';
import { ERROR_CODES, get } from '../../lib/api.js';
import { LIMITS, ROUTES } from '../../lib/constants.js';
import { formatNumber, formatRating, formatYuan } from '../../lib/format.js';

/** 图集最多展示张数（1 主 + 2 副） */
const GALLERY_MAX = 3;

/** 侧栏「同地区其它景区」最多条数 */
const ASIDE_SCENIC_MAX = 3;

/** 同地区景区一次性取 4 条（含当前景区本身） */
const REGION_SCENIC_LIMIT = 4;

/**
 * 把接口返回取成 list。
 * @param {any} data
 * @returns {object[]}
 */
function toList(data) {
  return data && Array.isArray(data.list) ? data.list : [];
}

/**
 * 景区详情。
 * @returns {JSX.Element}
 */
export function ScenicDetail() {
  const { id } = useParams();

  const [scenic, setScenic] = useState(null);
  const [region, setRegion] = useState(null);
  const [regionScenics, setRegionScenics] = useState([]);
  const [travels, setTravels] = useState([]);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let alive = true;

    /**
     * 先取详情，再并行取同地区景区与关联游记（后两者失败不影响主内容）。
     */
    const run = async () => {
      setLoading(true);
      setNotFound(false);
      setError('');
      setScenic(null);
      setRegion(null);
      setRegionScenics([]);
      setTravels([]);

      try {
        const detail = await get(`/scenics/${id}`, { signal });
        if (!alive) return;

        const nextScenic = detail && detail.scenic ? detail.scenic : null;
        const nextRegion = detail && detail.region ? detail.region : null;
        if (!nextScenic) {
          setError('景区数据不完整，请稍后重试');
          setLoading(false);
          return;
        }

        setScenic(nextScenic);
        setRegion(nextRegion);
        setFavoriteCount(Number(nextScenic.favoriteCount) || 0);

        const [regionRes, travelRes] = await Promise.allSettled([
          nextScenic.regionId
            ? get('/scenics', {
                query: { regionId: nextScenic.regionId, limit: REGION_SCENIC_LIMIT },
                signal,
              })
            : Promise.resolve(null),
          get(`/scenics/${id}/travels`, { query: { limit: LIMITS.SCENIC_TRAVELS }, signal }),
        ]);
        if (!alive) return;

        setRegionScenics(regionRes.status === 'fulfilled' ? toList(regionRes.value) : []);
        setTravels(travelRes.status === 'fulfilled' ? toList(travelRes.value) : []);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        if (err && err.code === ERROR_CODES.NOT_FOUND) setNotFound(true);
        else setError((err && err.message) || '景区加载失败');
        setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [id, reloadKey]);

  // 图集：本景区封面 + 后台 gallery + 同地区其它景区封面，去重后取前 3 张（不新增图片文件）；
  // 去重后不足 3 张时循环复用已有图片补满 3 个槽位，保证「1 主 + 2 副」布局恒定
  const galleryImages = useMemo(() => {
    if (!scenic) return [];
    const fromGallery = Array.isArray(scenic.gallery) ? scenic.gallery : [];
    const pool = [scenic.coverImage, ...fromGallery, ...regionScenics.map((item) => item.coverImage)];
    const unique = [];
    pool.forEach((src) => {
      if (src && !unique.includes(src)) unique.push(src);
    });
    if (!unique.length) return [];

    const slots = unique.slice(0, GALLERY_MAX);
    let cursor = 0;
    while (slots.length < GALLERY_MAX) {
      slots.push(unique[cursor % unique.length]);
      cursor += 1;
    }
    return slots;
  }, [scenic, regionScenics]);

  // 侧栏：同地区其它景区（排除当前景区）
  const asideScenics = useMemo(
    () => regionScenics.filter((item) => item.id !== Number(id)).slice(0, ASIDE_SCENIC_MAX),
    [regionScenics, id],
  );

  // InfoBar：只保留有值的列，缺失字段整列隐藏（不显示 undefined / 空字符串）
  const infoItems = useMemo(() => {
    if (!scenic) return [];
    const candidates = [
      { label: '开放时间', value: scenic.openTime, icon: 'clock' },
      { label: '门票参考', value: scenic.ticketPrice ? formatYuan(scenic.ticketPrice) : '', icon: 'ticket' },
      { label: '交通指引', value: scenic.traffic, icon: 'traffic' },
      { label: '最佳季节', value: scenic.bestSeason, icon: 'season' },
    ];
    return candidates.filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');
  }, [scenic]);

  const highlights = scenic && Array.isArray(scenic.highlights) ? scenic.highlights.filter(Boolean) : [];

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="stack stack--lg">
            <Skeleton variant="card" height="360px" />
            <Skeleton variant="line" count={2} />
            <Skeleton variant="detail" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <section className="p-detail-404">
            <p className="p-detail-404__code">404</p>
            <h1 className="p-detail-404__title">这个景区暂时找不到了</h1>
            <p className="p-detail-404__desc">
              可能已经下架，也可能链接里的编号不对。景区列表里还有别的目的地可以挑。
            </p>
            <div className="p-detail-404__actions">
              <Link className="btn btn--primary" to={ROUTES.SCENIC_LIST}>
                <span className="btn__label">返回景区列表</span>
              </Link>
              <Link className="btn btn--ghost" to={ROUTES.HOME}>
                <span className="btn__label">回到首页</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error || !scenic) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <EmptyState
            art="mountain"
            title="景区加载失败"
            desc={error || '没有取到这个景区的内容。'}
            actionText="重新加载"
            onAction={() => setReloadKey((prev) => prev + 1)}
          />
        </div>
      </div>
    );
  }

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
          <Link className="breadcrumb__link" to={ROUTES.SCENIC_LIST}>
            景区
          </Link>
          <span className="breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb__current">{scenic.name}</span>
        </nav>

        <div className="p-detail-gallery">
          <ImageGallery images={galleryImages} title={scenic.name} />
        </div>

        <header className="p-detail-title">
          <div className="p-detail-title__main">
            <h1 className="p-detail-title__name">{scenic.name}</h1>
            <div className="p-detail-title__meta">
              {scenic.regionName && scenic.regionId ? (
                <Link className="p-detail-title__tag-link" to={`${ROUTES.SCENIC_LIST}?regionId=${scenic.regionId}`}>
                  <Tag variant="region">{scenic.regionName}</Tag>
                </Link>
              ) : null}
              {scenic.level ? <Tag variant="level">{scenic.level}</Tag> : null}
              {scenic.isRecommended ? <Tag variant="recommend">编辑推荐</Tag> : null}
              <span className="p-detail-title__stat">
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.9l-3.2 1.8.6-3.6L1.8 5.6l3.6-.5z" />
                </svg>
                {formatRating(scenic.rating)}
              </span>
              <span className="p-detail-title__stat">
                <svg viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M7 11.8S2 8.9 2 5.6a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1c0 3.3-5 6.2-5 6.2z" />
                </svg>
                <span className="num">{formatNumber(favoriteCount)}</span> 人收藏
              </span>
            </div>
          </div>

          <div className="p-detail-title__actions">
            <FavoriteButton
              scenic={scenic}
              onChange={({ favoriteCount: nextCount }) => setFavoriteCount(nextCount)}
            />
          </div>
        </header>

        {infoItems.length > 0 ? (
          <div className="p-detail-infobar">
            <InfoBar items={infoItems} />
          </div>
        ) : null}

        <div className="detail-layout p-detail-body">
          <div className="p-detail-main">
            <section className="p-detail-section">
              <h2 className="p-detail-section__title">景区简介</h2>
              <ArticleBody content={scenic.description} />
            </section>

            {highlights.length > 0 ? (
              <section className="p-detail-section">
                <h2 className="p-detail-section__title">景区看点</h2>
                <ol className="p-detail-highlights">
                  {highlights.map((item, index) => (
                    <li className="p-detail-highlight" key={`${item}-${index}`}>
                      <span className="p-detail-highlight__index num">{index + 1}</span>
                      <span className="p-detail-highlight__text">{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <aside className="p-detail-aside">
            {region ? (
              <div className="p-detail-aside__block">
                <h2 className="p-detail-aside__title">所在地区</h2>
                <RegionCard region={region} />
              </div>
            ) : null}

            {asideScenics.length > 0 ? (
              <div className="p-detail-aside__block">
                <h2 className="p-detail-aside__title">同地区其它景区</h2>
                <ul className="p-detail-aside-list">
                  {asideScenics.map((item) => (
                    <li key={item.id}>
                      <Link className="p-detail-aside-scenic" to={`/scenic/${item.id}`}>
                        {item.coverImage ? (
                          <img src={item.coverImage} alt={item.name} loading="lazy" />
                        ) : null}
                        <span className="p-detail-aside-scenic__body">
                          <span className="p-detail-aside-scenic__name">{item.name}</span>
                          <span className="p-detail-aside-scenic__meta">
                            {item.level ? `${item.level} · ` : ''}评分 {formatRating(item.rating)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="p-detail-travels__head">
            <h2 className="p-detail-travels__title">本景区游记</h2>
            <Link className="section-header__more" to={ROUTES.TRAVEL_LIST}>
              查看全部游记
            </Link>
          </div>

          {travels.length > 0 ? (
            <div className="stack">
              {travels.map((travel) => (
                <TravelCard travel={travel} horizontal key={travel.id} />
              ))}
            </div>
          ) : (
            <EmptyState art="map" title="该景区暂无游记" desc="如果你刚去过，欢迎把行程写下来。" />
          )}
        </div>
      </section>
    </div>
  );
}

export default ScenicDetail;
