/**
 * 卡片（DESIGN §6.2 `.card`）
 *
 * 导出：Card / CardMedia / CardBody / CardMeta（默认导出 Card）
 *
 * props：
 *   Card      {hover, horizontal, flat, as='div', className, children, ...rest}
 *   CardMedia {src, alt, ratio='16/9', children}   img onError → 父容器加 .img-fallback 并显示 alt 首字
 *   CardBody  {children}
 *   CardMeta  {children}
 *
 * 用法：
 *   <Card hover as={Link} to={`/scenic/${id}`}>
 *     <CardMedia src={coverImage} alt={name} />
 *     <CardBody><h3>{name}</h3></CardBody>
 *   </Card>
 */

import { useState } from 'react';

import { initialOf } from '../../lib/format.js';

/**
 * 卡片容器。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Card({
  children,
  hover = false,
  horizontal = false,
  flat = false,
  as: Component = 'div',
  className = '',
  ...rest
}) {
  const classes = ['card'];
  if (hover) classes.push('card--hover');
  if (horizontal) classes.push('card--horizontal');
  if (flat) classes.push('card--flat');
  if (className) classes.push(className);

  return (
    <Component className={classes.join(' ')} {...rest}>
      {children}
    </Component>
  );
}

/**
 * 卡片封面。默认 16:9；传其它比例时用内联 aspect-ratio（唯一允许的内联样式：动态比例）。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function CardMedia({ src = '', alt = '', ratio = '16/9', children, className = '', ...rest }) {
  const [failed, setFailed] = useState(false);
  const classes = ['card__media'];
  if (failed) classes.push('img-fallback');
  if (className) classes.push(className);

  // 仅当比例不是默认 16/9 时才写内联，避免覆盖 .card--horizontal 的 aspect-ratio:auto
  const style = ratio && ratio !== '16/9' ? { aspectRatio: ratio } : undefined;

  return (
    <div className={classes.join(' ')} style={style} data-fallback={initialOf(alt)} {...rest}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : null}
      {children}
    </div>
  );
}

/**
 * 卡片正文区。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function CardBody({ children, className = '', ...rest }) {
  const classes = ['card__body'];
  if (className) classes.push(className);
  return (
    <div className={classes.join(' ')} {...rest}>
      {children}
    </div>
  );
}

/**
 * 卡片底部信息行（评分 / 收藏数等）。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function CardMeta({ children, className = '', ...rest }) {
  const classes = ['card__meta'];
  if (className) classes.push(className);
  return (
    <div className={classes.join(' ')} {...rest}>
      {children}
    </div>
  );
}

export default Card;
