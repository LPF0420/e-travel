/**
 * 首页首屏横幅 + 搜索（DESIGN §6.2 / P-01）
 *
 * props：
 *   image=HERO_IMAGE   背景图（九寨沟）
 *   title / subtitle   大标题（衬线，最多两行）/ 副标题
 *   keyword            外部传入的初始关键词（受控回填）
 *   onSearch(value)    点击搜索或热门词
 *   stats              { regionCount, scenicCount, travelCount } 右下角统计小字
 *
 * 用法：
 *   <HeroSearch keyword={keyword} onSearch={(v) => navigate(`/scenic?keyword=${encodeURIComponent(v)}`)}
 *               stats={{ regionCount: 8, scenicCount: 8, travelCount: 8 }} />
 */

import { useEffect, useState } from 'react';

import { HERO_IMAGE } from '../../lib/constants.js';

/** 热门关键词（教学演示固定几个，均能在种子数据里命中） */
const HOT_KEYWORDS = ['九寨沟', '西湖', '张家界', '三亚', '桂林'];

/**
 * 首屏横幅。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function HeroSearch({
  image = HERO_IMAGE,
  title = '把山川湖海，写成一条可以出发的路',
  subtitle = '一处风景的前世今生，一段路程的取舍与绕行。这里有景区介绍，也有走过的人留下的攻略。',
  keyword = '',
  onSearch,
  stats = null,
}) {
  const [value, setValue] = useState(keyword || '');

  // 外部 keyword 变化时回填（从列表页返回首页时保持一致）
  useEffect(() => {
    setValue(keyword || '');
  }, [keyword]);

  /**
   * 提交搜索。
   * @param {React.FormEvent<HTMLFormElement>} event
   * @param {string} [preset] 热门词点击时直接传值
   */
  const submit = (event, preset) => {
    if (event) event.preventDefault();
    const text = String(preset === undefined ? value : preset).trim();
    if (!text) return;
    setValue(text);
    if (typeof onSearch === 'function') onSearch(text);
  };

  const statText = stats
    ? `${stats.regionCount || 0} 个地区 · ${stats.scenicCount || 0} 个景区 · ${stats.travelCount || 0} 篇游记`
    : '';

  return (
    <section className="hero">
      <img className="hero__media" src={image} alt="" aria-hidden="true" />
      <div className="hero__overlay" />

      <div className="hero__inner">
        <h1 className="hero__title">{title}</h1>
        {subtitle ? <p className="hero__subtitle">{subtitle}</p> : null}

        <form className="hero__search" onSubmit={submit} role="search">
          <input
            className="input"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="想去哪里？试试「九寨沟」或「西湖」"
            aria-label="搜索景区"
          />
          <button type="submit" className="btn btn--primary">
            <span className="btn__label">搜索</span>
          </button>
        </form>

        <div className="hero__hot">
          <span>热门：</span>
          {HOT_KEYWORDS.map((item) => (
            <button
              key={item}
              type="button"
              className="hero__chip"
              onClick={() => submit(null, item)}
            >
              {item}
            </button>
          ))}
        </div>

        {statText ? <div className="hero__stats">{statText}</div> : null}
      </div>
    </section>
  );
}

export default HeroSearch;
