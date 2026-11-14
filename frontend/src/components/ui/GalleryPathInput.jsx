/**
 * 图集路径输入（F-37 景区图集：多行路径 + 缩略图 + 上移下移 + 删除）
 *
 * props：value=[], onChange(新数组), max=5
 *
 * 用法：<GalleryPathInput value={form.gallery} onChange={(list) => setForm({...form, gallery: list})} max={5} />
 */

import FormField from './FormField.jsx';
import Input from './Input.jsx';

/** 上移图标 */
function UpIcon() {
  return (
    <svg viewBox="0 0 13 13" aria-hidden="true">
      <path d="M6.5 10.5V3M3 6.2l3.5-3.4L10 6.2" />
    </svg>
  );
}

/** 下移图标 */
function DownIcon() {
  return (
    <svg viewBox="0 0 13 13" aria-hidden="true">
      <path d="M6.5 2.5v7.5M3 7.3l3.5 3.4L10 7.3" />
    </svg>
  );
}

/** 删除图标 */
function TrashIcon() {
  return (
    <svg viewBox="0 0 13 13" aria-hidden="true">
      <path d="M2.5 3.5h8M5 3.5V2h3v1.5M3.6 3.5l.5 7h4.8l.5-7" />
    </svg>
  );
}

/**
 * 图集路径输入。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function GalleryPathInput({ value = [], onChange, max = 5, label = '', disabled = false, error = '' }) {
  const list = Array.isArray(value) ? value : [];
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 5;

  /**
   * 提交新数组（先做一次浅拷贝，避免直接改入参）。
   * @param {string[]} next
   */
  const emit = (next) => {
    if (typeof onChange === 'function') onChange(next);
  };

  /**
   * 修改某一行。
   * @param {number} index
   * @param {string} nextPath
   */
  const updateAt = (index, nextPath) => {
    const next = list.slice();
    next[index] = nextPath;
    emit(next);
  };

  /**
   * 上移 / 下移。
   * @param {number} index
   * @param {number} offset
   */
  const move = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    emit(next);
  };

  /**
   * 删除某行。
   * @param {number} index
   */
  const removeAt = (index) => {
    emit(list.filter((_, itemIndex) => itemIndex !== index));
  };

  const body = (
    <div className="gallery-input">
      {list.length === 0 ? <p className="gallery-input__empty">暂未添加图片，点下方按钮新增（最多 {limit} 张）</p> : null}

      {list.map((item, index) => (
        <div className="gallery-input__row" key={`gallery-row-${index}`}>
          <span className="gallery-input__thumb">
            {item ? <img src={item} alt={`图集第 ${index + 1} 张`} /> : null}
          </span>
          <Input
            value={item}
            onChange={(event) => updateAt(index, event.target.value)}
            placeholder="/images/jiuzhaigou.jpg"
            disabled={disabled}
          />
          <span className="gallery-input__tools">
            <button
              type="button"
              className="gallery-input__tool"
              onClick={() => move(index, -1)}
              disabled={disabled || index === 0}
              aria-label="上移"
            >
              <UpIcon />
            </button>
            <button
              type="button"
              className="gallery-input__tool"
              onClick={() => move(index, 1)}
              disabled={disabled || index === list.length - 1}
              aria-label="下移"
            >
              <DownIcon />
            </button>
            <button
              type="button"
              className="gallery-input__tool"
              onClick={() => removeAt(index)}
              disabled={disabled}
              aria-label="删除这张"
            >
              <TrashIcon />
            </button>
          </span>
        </div>
      ))}

      <div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => emit([...list, ''])}
          disabled={disabled || list.length >= limit}
        >
          <span className="btn__label">添加一张</span>
        </button>
      </div>
    </div>
  );

  if (!label) return body;

  return (
    <FormField label={label} error={error} hint={`最多 ${limit} 张，路径需以 /images/ 开头`}>
      {body}
    </FormField>
  );
}

export default GalleryPathInput;
