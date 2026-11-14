/**
 * 地区卡片（DESIGN：封面 + 底部渐变 + 地区名 + 「N 个景区」）
 *
 * props：region（id, name, coverImage, scenicCount）
 * 点击进入 /scenic?regionId=（列表页按地区筛选）。
 *
 * 用法：<RegionCard region={region} />
 */

import { Link } from 'react-router-dom';

/**
 * 地区卡片。
 * @param {{ region: object }} props
 * @returns {JSX.Element|null}
 */
export function RegionCard({ region }) {
  if (!region) return null;

  const { id, name = '', coverImage = '', scenicCount = 0 } = region;

  return (
    <Link className="region-card" to={`/scenic?regionId=${id}`}>
      {coverImage ? <img src={coverImage} alt={name} loading="lazy" /> : null}
      <div className="region-card__overlay" />
      <div className="region-card__body">
        <p className="region-card__name">{name}</p>
        <span className="region-card__count">{scenicCount} 个景区</span>
      </div>
    </Link>
  );
}

export default RegionCard;
