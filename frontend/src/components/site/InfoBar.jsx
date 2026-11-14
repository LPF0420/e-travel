/**
 * 信息条（DESIGN：开放时间 / 门票 / 交通 / 最佳季节，四列；窄屏两列/一列）
 *
 * props：items=[{ label, value, icon }]，icon 为内联 SVG 名（clock / ticket / traffic / season）
 *
 * 用法：
 *   <InfoBar items={[
 *     { label: '开放时间', value: scenic.openTime, icon: 'clock' },
 *     { label: '门票', value: scenic.ticketPrice, icon: 'ticket' },
 *     { label: '交通', value: scenic.traffic, icon: 'traffic' },
 *     { label: '最佳季节', value: scenic.bestSeason, icon: 'season' },
 *   ]} />
 */

/** 时钟 */
function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6v4.2l2.8 1.8" />
    </svg>
  );
}

/** 门票 */
function TicketIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 16.5 6v1.5a2.5 2.5 0 0 0 0 5V14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 14v-1.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M8.5 8.2v3.6" />
    </svg>
  );
}

/** 交通 */
function TrafficIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M2.8 10h14.4M10 2.8c2 2.2 3 4.6 3 7.2s-1 5-3 7.2c-2-2.2-3-4.6-3-7.2s1-5 3-7.2" />
    </svg>
  );
}

/** 季节（叶子） */
function SeasonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16 4c0 7-4.4 11-9.4 11H4.4C4.4 9 8.8 4 16 4Z" />
      <path d="M4.6 15.6c1.6-4 4-6.6 8-8.4" />
    </svg>
  );
}

/** 图标映射表 */
const ICON_MAP = {
  clock: ClockIcon,
  ticket: TicketIcon,
  traffic: TrafficIcon,
  season: SeasonIcon,
};

/**
 * 信息条。
 * @param {{ items?: Array<{label:string, value:string, icon?:string}> }} props
 * @returns {JSX.Element|null}
 */
export function InfoBar({ items = [] }) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && item.label);
  if (!list.length) return null;

  return (
    <div className="infobar">
      {list.map((item) => {
        const Icon = ICON_MAP[item.icon] || ClockIcon;
        return (
          <div className="infobar__item" key={item.label}>
            <span className="infobar__icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="infobar__text">
              <span className="infobar__label">{item.label}</span>
              <span className="infobar__value">{item.value || '—'}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default InfoBar;
