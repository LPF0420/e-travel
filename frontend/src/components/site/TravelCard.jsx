/**
 * 游记卡片（DESIGN：封面 + 标题 + 景区标签 + 作者 + 日期 + 阅读时长）
 *
 * props：travel（id, title, coverImage, scenicName, authorName, publishedAt, content）, horizontal
 *
 * 用法：<TravelCard travel={travel} />            // 竖版（3 列栅格）
 *      <TravelCard travel={travel} horizontal />  // 横向（列表页 2 列）
 */

import { Link } from 'react-router-dom';

import { formatDate, readingMinutes, truncate } from '../../lib/format.js';
import Card, { CardBody, CardMedia, CardMeta } from '../ui/Card.jsx';
import Tag from '../ui/Tag.jsx';

/**
 * 游记卡片。
 * @param {{ travel: object, horizontal?: boolean }} props
 * @returns {JSX.Element|null}
 */
export function TravelCard({ travel, horizontal = false }) {
  if (!travel) return null;

  const { id, title = '', coverImage = '', scenicName = '', authorName = '', publishedAt, content = '' } = travel;

  return (
    <Card as={Link} to={`/travels/${id}`} hover horizontal={horizontal} className="travel-card">
      <CardMedia src={coverImage} alt={title} />
      <CardBody>
        {scenicName ? <Tag variant="region">{scenicName}</Tag> : null}
        <h3 className="travel-card__title">{title}</h3>
        {!horizontal ? <p className="travel-card__excerpt">{truncate(content, 68)}</p> : null}
        <CardMeta>
          <span className="travel-card__byline">
            <span className="travel-card__author">{authorName}</span>
            <span className="travel-card__dot" aria-hidden="true" />
            <span>{formatDate(publishedAt)}</span>
          </span>
          <span>{readingMinutes(content)} 分钟</span>
        </CardMeta>
      </CardBody>
    </Card>
  );
}

export default TravelCard;
