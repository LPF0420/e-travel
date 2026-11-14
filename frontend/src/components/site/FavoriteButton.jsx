/**
 * 收藏按钮（DESIGN §5.1：未登录 → Toast + 去登录；已登录 → 乐观更新 + 失败回滚）
 *
 * props：
 *   scenic    景区对象（至少需要 id；可选 isFavorited / favoriteCount）
 *   size      'md' | 'sm'
 *   block     全宽
 *   onChange({ favorited, favoriteCount })  收藏数变化回调（详情页可同步顶部数字）
 *
 * 接口：POST /api/favorites { scenicId }（幂等）/ DELETE /api/favorites/:scenicId
 * 样式：.favorite-btn（橙色实心）；已收藏为描边 + 实心星（.is-favorited）
 *
 * 用法：<FavoriteButton scenic={scenic} block onChange={({ favoriteCount }) => setCount(favoriteCount)} />
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { del, post } from '../../lib/api.js';
import { ROUTES } from '../../lib/constants.js';
import { formatNumber } from '../../lib/format.js';

/** 五角星 */
function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l1.9 3.9 4.3.6-3.1 3 .8 4.3L8 11.7 4.1 13.8l.8-4.3-3.1-3 4.3-.6z" />
    </svg>
  );
}

/**
 * 收藏按钮。
 * @param {object} props
 * @returns {JSX.Element|null}
 */
export function FavoriteButton({ scenic, size = 'md', block = false, onChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { member } = useMemberAuth();
  const { showToast } = useToast();

  const scenicId = scenic ? scenic.id : null;
  const [favorited, setFavorited] = useState(Boolean(scenic && scenic.isFavorited));
  const [count, setCount] = useState(Number(scenic && scenic.favoriteCount) || 0);
  const [pending, setPending] = useState(false);

  // 外部数据（详情页重新拉取 / 切换景区）时同步本地态
  useEffect(() => {
    setFavorited(Boolean(scenic && scenic.isFavorited));
    setCount(Number(scenic && scenic.favoriteCount) || 0);
  }, [scenicId, scenic && scenic.isFavorited, scenic && scenic.favoriteCount]);

  if (!scenic || scenicId === null) return null;

  /**
   * 切换收藏（未登录拦截 / 乐观更新 / 失败回滚）。
   */
  const toggle = async () => {
    if (pending) return;

    if (!member) {
      showToast('登录后才能收藏', 'info');
      const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
      navigate(`${ROUTES.MEMBER_LOGIN}?redirect=${redirect}`);
      return;
    }

    const prevFavorited = favorited;
    const prevCount = count;
    const nextFavorited = !prevFavorited;
    const nextCount = Math.max(0, prevCount + (nextFavorited ? 1 : -1));

    setFavorited(nextFavorited);
    setCount(nextCount);
    setPending(true);

    try {
      const data = nextFavorited
        ? await post('/favorites', { scenicId }, { scope: 'member' })
        : await del(`/favorites/${scenicId}`, { scope: 'member' });

      const realFavorited = data && typeof data.favorited === 'boolean' ? data.favorited : nextFavorited;
      const realCount = data && typeof data.favoriteCount === 'number' ? data.favoriteCount : nextCount;
      setFavorited(realFavorited);
      setCount(realCount);
      if (typeof onChange === 'function') onChange({ favorited: realFavorited, favoriteCount: realCount });
      showToast(realFavorited ? '已加入收藏' : '已取消收藏', realFavorited ? 'success' : 'info');
    } catch (error) {
      // 回滚
      setFavorited(prevFavorited);
      setCount(prevCount);
      if (error && (error.status === 401 || error.status === 403)) return;
      showToast((error && error.message) || '操作失败，请稍后重试', 'error');
    } finally {
      setPending(false);
    }
  };

  const classes = ['favorite-btn'];
  if (favorited) classes.push('is-favorited');
  if (size === 'sm') classes.push('favorite-btn--sm');
  if (block) classes.push('favorite-btn--block');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? '取消收藏' : '收藏'}
    >
      <StarIcon />
      <span>{favorited ? '已收藏' : '收藏'}</span>
      {count > 0 ? <span className="num">{formatNumber(count)}</span> : null}
    </button>
  );
}

export default FavoriteButton;
