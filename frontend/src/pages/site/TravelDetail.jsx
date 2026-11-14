/**
 * P-05 游记详情（PRD §5.1 P-05）
 *
 * 数据：GET /api/travels/:id → { travel, scenic, related }
 * 结构：面包屑 → 标题 + 元信息（作者 / 发布日期 / 阅读时长 / 所属景区标签）
 *       → 封面大图 → ArticleBody 正文（760px 居中）→ ScenicCalloutCard
 *       → 相关游记 3 篇。
 * 空态 / 错误态：code 1002 → 页内 404 区块（不白屏）；正文为空 → 「内容整理中」。
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ArticleBody from '../../components/site/ArticleBody.jsx';
import ScenicCalloutCard from '../../components/site/ScenicCalloutCard.jsx';
import TravelCard from '../../components/site/TravelCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import Tag from '../../components/ui/Tag.jsx';
import { ERROR_CODES, get } from '../../lib/api.js';
import { ROUTES } from '../../lib/constants.js';
import { formatDate, initialOf, readingMinutes } from '../../lib/format.js';

/**
 * 游记详情。
 * @returns {JSX.Element}
 */
export function TravelDetail() {
  const { id } = useParams();

  const [travel, setTravel] = useState(null);
  const [scenic, setScenic] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setNotFound(false);
    setError('');
    setTravel(null);
    setScenic(null);
    setRelated([]);

    get(`/travels/${id}`, { signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        setTravel(data && data.travel ? data.travel : null);
        setScenic(data && data.scenic ? data.scenic : null);
        setRelated(data && Array.isArray(data.related) ? data.related : []);
      })
      .catch((err) => {
        if (!alive) return;
        if (err && err.code === ERROR_CODES.NOT_FOUND) {
          setNotFound(true);
        } else {
          setError((err && err.message) || '游记加载失败');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [id, reloadKey]);

  if (loading) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <div className="stack stack--lg">
            <Skeleton variant="line" count={3} />
            <Skeleton variant="card" height="320px" />
            <Skeleton variant="line" count={6} />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <section className="p-travel-404">
            <p className="p-travel-404__code">404</p>
            <h1 className="p-travel-404__title">这篇游记已经不在了</h1>
            <p className="p-travel-404__desc">
              可能链接抄错了一位，也可能作者把它撤回了。游记列表里还有别的行程。
            </p>
            <div className="p-travel-404__actions">
              <Link className="btn btn--primary" to={ROUTES.TRAVEL_LIST}>
                <span className="btn__label">返回游记列表</span>
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

  if (error || !travel) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <EmptyState
            art="map"
            title="游记加载失败"
            desc={error || '没有取到这篇游记的内容。'}
            actionText="重新加载"
            onAction={() => setReloadKey((prev) => prev + 1)}
          />
        </div>
      </div>
    );
  }

  const { title = '', coverImage = '', authorName = '', publishedAt, content = '', scenicName = '' } = travel;
  const hasContent = Boolean(String(content || '').trim());

  return (
    <div className="page">
      <div className="container container--narrow">
        <nav className="breadcrumb" aria-label="面包屑">
          <Link className="breadcrumb__link" to={ROUTES.HOME}>
            首页
          </Link>
          <span className="breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <Link className="breadcrumb__link" to={ROUTES.TRAVEL_LIST}>
            游记
          </Link>
          <span className="breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb__current">{title}</span>
        </nav>

        <article className="p-travel-article">
          <header className="p-travel-head">
            {scenicName ? (
              <Link className="p-travel-head__scenic" to={scenic && scenic.id ? `/scenic/${scenic.id}` : ROUTES.SCENIC_LIST}>
                <Tag variant="region">{scenicName}</Tag>
              </Link>
            ) : null}
            <h1 className="p-travel-head__title">{title}</h1>
            <div className="p-travel-meta">
              <span className="p-travel-meta__author">
                <span className="avatar avatar--sm">{initialOf(authorName)}</span>
                <span>{authorName || '匿名作者'}</span>
              </span>
              <span className="p-travel-meta__dot" aria-hidden="true" />
              <span>{formatDate(publishedAt)}</span>
              <span className="p-travel-meta__dot" aria-hidden="true" />
              <span>约 {readingMinutes(content)} 分钟读完</span>
            </div>
          </header>

          {coverImage ? (
            <figure className="p-travel-cover">
              <img src={coverImage} alt={title} loading="lazy" />
            </figure>
          ) : null}

          <div className="p-travel-body">
            {hasContent ? (
              <ArticleBody content={content} />
            ) : (
              <p className="p-travel-empty">内容整理中，作者正在补充照片与路线细节。</p>
            )}
          </div>

          {scenic ? (
            <div className="p-travel-callout">
              <ScenicCalloutCard scenic={scenic} />
            </div>
          ) : null}
        </article>
      </div>

      <section className="section">
        <div className="container">
          <h2 className="p-travel-related__title">相关游记</h2>
          {related.length > 0 ? (
            <div className="grid grid--3">
              {related.map((item) => (
                <TravelCard travel={item} key={item.id} />
              ))}
            </div>
          ) : (
            <EmptyState art="map" title="暂无相关游记" desc="同类行程还在整理中。" />
          )}
        </div>
      </section>
    </div>
  );
}

export default TravelDetail;
