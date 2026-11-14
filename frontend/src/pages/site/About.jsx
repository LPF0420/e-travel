/**
 * P-09 关于我们（PRD §5.1 P-09）
 *
 * 结构：页头 → 主视觉 about.jpg（21:9 裁切）→ 两栏（左 3 段站点介绍 / 右数据概览）
 *       →「我们相信」三条价值主张 → 底部 CTA（联系我们）。
 * 统计接口失败时数字显示「—」，正文不受影响（PRD 明确要求）。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { get } from '../../lib/api.js';
import { IMAGES, ROUTES, STATS_PATH } from '../../lib/constants.js';

/** 统计项的展示顺序与文案 */
const STAT_ITEMS = [
  { key: 'regionCount', label: '收录地区' },
  { key: 'scenicCount', label: '景区条目' },
  { key: 'travelCount', label: '旅行游记' },
];

/** 三条价值主张（图标 + 标题 + 一句描述） */
const VALUES = [
  {
    key: 'geo',
    title: '先讲地理，再讲攻略',
    desc: '山是怎么抬起来的、水为什么是这个颜色、风从哪边来——把这些说清楚，行程才排得合理。',
    icon: 'compass',
  },
  {
    key: 'ground',
    title: '攻略要能落地',
    desc: '开放时间、门票口径、交通耗时都尽量给到可执行的版本，而不是「建议早点去」这类空话。',
    icon: 'route',
  },
  {
    key: 'noRank',
    title: '不做排行榜',
    desc: '没有「一生必去」的名单。我们只把条件讲清楚，值不值得，由你的假期长度决定。',
    icon: 'book',
  },
];

/**
 * 价值主张图标（内联 SVG 映射，避免引入图标库）。
 * @param {{ name: string }} props
 * @returns {JSX.Element}
 */
function ValueIcon({ name }) {
  if (name === 'route') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="6" r="2.4" />
        <circle cx="18" cy="18" r="2.4" />
        <path d="M6 8.4v4.2a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
        <path d="M8 4.5v15M12 9h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-2 5-5 2 2-5z" />
    </svg>
  );
}

/**
 * 关于我们。
 * @returns {JSX.Element}
 */
export function About() {
  const [stats, setStats] = useState({ loading: true, value: null });

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    get(STATS_PATH, { signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        setStats({ loading: false, value: data || null });
      })
      .catch(() => {
        if (!alive) return;
        setStats({ loading: false, value: null });
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /**
   * 取统计数字；加载中或失败都显示「—」（PRD：不影响正文）。
   * @param {string} key
   * @returns {string}
   */
  const statValue = (key) => {
    if (!stats.value) return '—';
    const num = Number(stats.value[key]);
    return Number.isFinite(num) ? String(num) : '—';
  };

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <h1 className="page-head__title">关于我们</h1>
          <p className="page-head__sub">
            一个由编辑、地理爱好者和常年在路上的人一起维护的旅行资料站。
          </p>
        </header>
      </div>

      <figure className="p-about-hero">
        <img src={IMAGES.about} alt="山脊与云海" loading="lazy" />
      </figure>

      <div className="container">
        <section className="p-about-columns">
          <div className="p-about-body">
            <h2 className="p-about-body__title">从一本手写行程单开始</h2>
            <p>
              「e起去旅行」最早是一份抄在笔记本上的行程单。2019
              年秋天，几个在成都做地图与编辑工作的人，把三次川西自驾的路线、住过的客栈、哪一段路在修、哪个垭口下午会起雾，全都记在同一本本子上。后来本子被朋友借走、复印、再借出去，我们才发现：真正有用的旅行信息，往往不在榜单里，而在别人走过之后留下的那些具体细节里。
            </p>
            <h2 className="p-about-body__title">我们写一个景区时，在写什么</h2>
            <p>
              每一条景区介绍，我们尽量回答三件事：这地方为什么长成这样；一年里哪一段时间来最合适；到了之后，有限的时间应该花在哪几处。所以我们写九寨沟的水为什么会出现孔雀蓝，写张家界的石柱如何在雨后浮在云上，也写西湖为什么适合用走路而不是坐车去理解。这些内容来自公开的地理与方志资料，也来自我们自己反复走过的经验。
            </p>
            <h2 className="p-about-body__title">攻略来自走过的人</h2>
            <p>
              站内的游记，大多由会员投稿，再由编辑核对开放时间、门票口径和交通耗时。我们不按流量排序，也不做「必去清单」；同一处景区，有人写三日顺路的走法，也有人写只留半天的取舍，两种都值得被读到。网站没有售票入口，也没有广告位，你在这里看到的推荐，只跟风景本身有关。
            </p>
          </div>

          <aside className="aside-card p-about-stats">
            <h2 className="aside-card__title">站点数据</h2>
            {STAT_ITEMS.map((item) => (
              <div className="p-about-stat" key={item.key}>
                <span className="p-about-stat__num num">{statValue(item.key)}</span>
                <span className="p-about-stat__label">{item.label}</span>
              </div>
            ))}
            <p className="p-about-stats__hint">
              数据统计自站内已发布的公开内容，随编辑更新而变化。
            </p>
          </aside>
        </section>

        <section className="section p-about-values">
          <h2 className="p-about-values__title">我们相信</h2>
          <div className="grid grid--3 p-about-values__grid">
            {VALUES.map((item) => (
              <article className="p-about-value" key={item.key}>
                <span className="p-about-value__icon" aria-hidden="true">
                  <ValueIcon name={item.icon} />
                </span>
                <h3 className="p-about-value__title">{item.title}</h3>
                <p className="p-about-value__desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="p-about-cta">
          <p className="p-about-cta__text">
            发现信息过期、路线有误，或者只是想聊聊某处风景？
          </p>
          <Link className="btn btn--primary" to={ROUTES.CONTACT}>
            <span className="btn__label">联系我们</span>
          </Link>
        </section>
      </div>
    </div>
  );
}

export default About;
