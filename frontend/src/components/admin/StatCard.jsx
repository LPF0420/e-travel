/**
 * 后台统计卡（DESIGN：衬线大号数字 + 标签 + 提示；可点击跳转）
 *
 * props：
 *   label  指标名（如「会员总数」）
 *   value  数值（数字或字符串）
 *   hint   补充说明（如「本月新增 2 位」）
 *   icon   图标名（members/scenics/travels/feedbacks/regions/favorites/logs）或 ReactNode
 *   to     传入则可点击跳转
 *   tone   'primary' | 'accent' | 'sky'
 *
 * 用法：<StatCard label="会员总数" value={stats.memberCount} icon="members" to="/admin/members" />
 */

import { Link } from 'react-router-dom';

import { formatNumber } from '../../lib/format.js';

/** 会员 */
function MembersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8" cy="7" r="3" />
      <path d="M2.8 16c0-2.6 2.3-4.4 5.2-4.4s5.2 1.8 5.2 4.4" />
      <path d="M14 5.2a3 3 0 0 1 0 5.6" />
    </svg>
  );
}

/** 景区 */
function ScenicsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.5 16h15" />
      <path d="M3.5 16 8.4 6.4l2.8 5 1.6-2.4L17 16" />
    </svg>
  );
}

/** 游记 */
function TravelsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3.2h7l3 3V16a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V4A.8.8 0 0 1 5 3.2Z" />
      <path d="M11.8 3.4v3.2h3.2M7 10h6M7 12.6h4" />
    </svg>
  );
}

/** 意见 */
function FeedbacksIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 13H8l-3.5 3v-3H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </svg>
  );
}

/** 地区 */
function RegionsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5l4.7-1.8 4.6 1.8L17 3.7v10.8l-4.7 1.8-4.6-1.8L3 16.3z" />
      <path d="M7.7 3.7v10.8M12.3 5.5v10.8" />
    </svg>
  );
}

/** 收藏 */
function FavoritesIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 16.5S3 12.3 3 7.8a3.6 3.6 0 0 1 7-1.1 3.6 3.6 0 0 1 7 1.1c0 4.5-7 8.7-7 8.7Z" />
    </svg>
  );
}

/** 日志 */
function LogsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 5.5h12M4 10h12M4 14.5h8" />
      <circle cx="16.2" cy="14.5" r="1.3" />
    </svg>
  );
}

/** icon 名 → 组件 */
const ICON_MAP = {
  members: MembersIcon,
  scenics: ScenicsIcon,
  travels: TravelsIcon,
  feedbacks: FeedbacksIcon,
  regions: RegionsIcon,
  favorites: FavoritesIcon,
  logs: LogsIcon,
};

/**
 * 统计卡。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function StatCard({ label = '', value = 0, hint = '', icon = null, to = '', tone = 'primary', className = '' }) {
  const safeTone = ['primary', 'accent', 'sky'].includes(tone) ? tone : 'primary';
  const classes = ['stat-card', `stat-card--${safeTone}`];
  if (className) classes.push(className);

  // icon 允许传名字字符串或直接传节点
  const iconNode =
    typeof icon === 'string' ? (
      (() => {
        const Icon = ICON_MAP[icon] || MembersIcon;
        return <Icon />;
      })()
    ) : (
      icon
    );

  const body = (
    <>
      <span className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">{typeof value === 'number' ? formatNumber(value) : value || '—'}</span>
        {hint ? <span className="stat-card__hint">{hint}</span> : null}
      </span>
      {iconNode ? (
        <span className="stat-card__icon" aria-hidden="true">
          {iconNode}
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link className={classes.join(' ')} to={to}>
        {body}
      </Link>
    );
  }

  return <div className={classes.join(' ')}>{body}</div>;
}

export default StatCard;
