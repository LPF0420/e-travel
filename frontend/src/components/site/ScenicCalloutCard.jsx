/**
 * 景区引导卡（游记详情底部：属于哪处景区 + 一句话 + 查看详情）
 *
 * props：scenic（id, name, coverImage, regionName, description）
 *
 * 用法：<ScenicCalloutCard scenic={scenic} />
 */

import { Link } from 'react-router-dom';

import { truncate } from '../../lib/format.js';

/**
 * 景区引导卡。
 * @param {{ scenic: object }} props
 * @returns {JSX.Element|null}
 */
export function ScenicCalloutCard({ scenic }) {
  if (!scenic) return null;

  const { id, name = '', coverImage = '', regionName = '', description = '' } = scenic;

  return (
    <div className="callout-card">
      <div className="callout-card__media">
        {coverImage ? <img src={coverImage} alt={name} loading="lazy" /> : null}
      </div>
      <div className="callout-card__body">
        <span className="callout-card__label">
          本篇游记所属景区{regionName ? ` · ${regionName}` : ''}
        </span>
        <p className="callout-card__title">{name}</p>
        <p className="callout-card__desc">{truncate(description, 48)}</p>
        <div className="callout-card__action">
          <Link className="btn btn--ghost btn--sm" to={`/scenic/${id}`}>
            <span className="btn__label">查看景区详情</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ScenicCalloutCard;
