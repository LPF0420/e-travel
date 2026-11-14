/**
 * 区块标题（DESIGN：标题 + 说明 + 右侧「查看全部 →」）
 *
 * props：title, desc, moreText='查看全部', moreTo, children
 *
 * 用法：<SectionHeader title="推荐景区" desc="编辑部挑出的 6 处" moreTo="/scenic" />
 */

import { Link } from 'react-router-dom';

/** 右箭头 */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" />
    </svg>
  );
}

/**
 * 区块标题。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function SectionHeader({ title = '', desc = '', moreText = '查看全部', moreTo = '', children = null }) {
  return (
    <div className="section-header">
      <div className="section-header__text">
        <h2 className="section-header__title">{title}</h2>
        {desc ? <p className="section-header__desc">{desc}</p> : null}
      </div>
      {children}
      {moreTo && moreText ? (
        <Link className="section-header__more" to={moreTo}>
          {moreText}
          <ArrowIcon />
        </Link>
      ) : null}
    </div>
  );
}

export default SectionHeader;
