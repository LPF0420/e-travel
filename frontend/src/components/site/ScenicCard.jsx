/**
 * 景区卡片（DESIGN §6.2：16:9 封面 + 地区标签 + 推荐标签 + 两行标题/摘要 + 评分与收藏数）
 *
 * props：
 *   scenic             景区对象（id, name, regionName, coverImage, level, rating, favoriteCount, description, isRecommended）
 *   onUnfavorite(scenic)  传入时右上角显示可点的「×」取消收藏（收藏页用）
 *   showFavoriteBadge   true → 右上角显示取消收藏角标
 *
 * 整卡可点进 /scenic/:id（Link 包裹）。
 *
 * 用法：<ScenicCard scenic={scenic} />
 */

import { Link } from 'react-router-dom';

import { formatNumber, formatRating, truncate } from '../../lib/format.js';
import Card, { CardBody, CardMedia, CardMeta } from '../ui/Card.jsx';
import Tag from '../ui/Tag.jsx';

/** 关闭图标（取消收藏角标） */
function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

/** 星星 */
function StarIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.9l-3.2 1.8.6-3.6L1.8 5.6l3.6-.5z" />
    </svg>
  );
}

/** 心形 */
function HeartIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 11.8S2 8.9 2 5.6a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1c0 3.3-5 6.2-5 6.2z" />
    </svg>
  );
}

/**
 * 景区卡片。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ScenicCard({ scenic, onUnfavorite, showFavoriteBadge = false }) {
  if (!scenic) return null;

  const {
    id,
    name = '',
    regionName = '',
    coverImage = '',
    level = '',
    rating,
    favoriteCount = 0,
    description = '',
    isRecommended = false,
  } = scenic;

  /**
   * 取消收藏：阻止冒泡，避免触发整卡跳转。
   * @param {React.MouseEvent<HTMLButtonElement>} event
   */
  const handleUnfavorite = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof onUnfavorite === 'function') onUnfavorite(scenic);
  };

  return (
    <Card as={Link} to={`/scenic/${id}`} hover className="scenic-card">
      <CardMedia src={coverImage} alt={name}>
        <div className="scenic-card__tags">
          {regionName ? <Tag variant="region">{regionName}</Tag> : null}
          {level ? <Tag variant="level">{level}</Tag> : null}
        </div>
        {showFavoriteBadge ? (
          <div className="scenic-card__badge">
            <button
              type="button"
              className="scenic-card__unfav"
              onClick={handleUnfavorite}
              aria-label={`取消收藏 ${name}`}
            >
              <CloseIcon />
            </button>
          </div>
        ) : isRecommended ? (
          <div className="scenic-card__badge">
            <Tag variant="recommend">推荐</Tag>
          </div>
        ) : null}
      </CardMedia>

      <CardBody>
        <h3 className="scenic-card__title">{name}</h3>
        <p className="scenic-card__desc">{truncate(description, 62)}</p>
        <CardMeta>
          <span className="scenic-card__stat scenic-card__star">
            <StarIcon />
            {formatRating(rating)}
          </span>
          <span className="scenic-card__stat">
            <HeartIcon />
            {formatNumber(favoriteCount)} 人收藏
          </span>
        </CardMeta>
      </CardBody>
    </Card>
  );
}

export default ScenicCard;
