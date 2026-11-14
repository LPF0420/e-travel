/**
 * P-08 我的收藏（PRD §5.1 P-08）
 *
 * 路由层已用 ProtectedRoute 包裹（未登录会带 redirect 跳登录），本页仍对 member 做兜底判断。
 * 数据：GET /api/favorites?page&pageSize（会员态）→ 分页包，元素是完整景区 + favoriteId/favoritedAt
 * 交互：卡片右上角「×」就地取消收藏（DELETE /api/favorites/:scenicId）→ 本地移除 + Toast
 * 空态：「还没有收藏的景区」+「去逛逛」；失败：空态 + 重试。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ScenicCard from '../../components/site/ScenicCard.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { SkeletonGrid } from '../../components/ui/Skeleton.jsx';
import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { del, get } from '../../lib/api.js';
import { PAGE_SIZE, ROUTES } from '../../lib/constants.js';

/**
 * 我的收藏。
 * @returns {JSX.Element}
 */
export function Favorites() {
  const navigate = useNavigate();
  const { member, loading: authLoading } = useMemberAuth();
  const { showToast } = useToast();

  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (authLoading || !member) return undefined;

    const controller = new AbortController();
    let alive = true;

    setLoading(true);
    setError('');

    get('/favorites', {
      query: { page, pageSize: PAGE_SIZE.FAVORITES },
      scope: 'member',
      signal: controller.signal,
    })
      .then((data) => {
        if (!alive) return;
        const nextList = data && Array.isArray(data.list) ? data.list : [];
        setList(nextList);
        setTotal(data && Number.isFinite(Number(data.total)) ? Number(data.total) : nextList.length);
      })
      .catch((err) => {
        if (!alive) return;
        setList([]);
        setTotal(0);
        setError((err && err.message) || '收藏列表加载失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [authLoading, member, page, reloadKey]);

  /**
   * 取消收藏（就地移除 + Toast）。
   * @param {object} scenic
   */
  const handleUnfavorite = async (scenic) => {
    if (!scenic || removingId !== null) return;
    setRemovingId(scenic.id);
    try {
      await del(`/favorites/${scenic.id}`, { scope: 'member' });
      setList((prev) => prev.filter((item) => item.id !== scenic.id));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast('已取消收藏', 'info');
    } catch (err) {
      showToast((err && err.message) || '取消收藏失败，请稍后重试', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  // 登录态确认中：只显示转圈，避免闪现空态
  if (authLoading) return <Spinner fullPage label="正在确认登录状态" />;

  // 兜底：未登录（ProtectedRoute 正常情况下已拦截）
  if (!member) {
    return (
      <div className="page">
        <div className="container container--narrow">
          <EmptyState
            art="suitcase"
            title="登录后才能查看收藏"
            desc="登录后，想去的地方会一直留在这里。"
            actionText="去登录"
            onAction={() => navigate(ROUTES.MEMBER_LOGIN)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <h1 className="page-head__title">我的收藏</h1>
          <p className="page-head__sub">
            共 <strong className="num">{total}</strong> 个景区 · 放假前翻一遍，就是现成的备选清单
          </p>
        </header>

        {loading ? <SkeletonGrid count={PAGE_SIZE.FAVORITES} /> : null}

        {!loading && error ? (
          <EmptyState
            art="mountain"
            title="收藏列表加载失败"
            desc={error}
            actionText="重新加载"
            onAction={() => setReloadKey((prev) => prev + 1)}
          />
        ) : null}

        {!loading && !error && list.length === 0 ? (
          <EmptyState
            art="suitcase"
            title="还没有收藏的景区"
            desc="在景区详情页点「收藏」，把想去的先存起来。"
            actionText="去逛逛"
            onAction={() => navigate(ROUTES.SCENIC_LIST)}
          />
        ) : null}

        {!loading && !error && list.length > 0 ? (
          <div className="grid grid--3">
            {list.map((scenic) => (
              <ScenicCard
                scenic={scenic}
                key={scenic.id}
                showFavoriteBadge
                onUnfavorite={handleUnfavorite}
              />
            ))}
          </div>
        ) : null}

        {!loading && !error && total > PAGE_SIZE.FAVORITES ? (
          <div className="p-fav-pager">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE.FAVORITES}
              total={total}
              onChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Favorites;
