/**
 * 封面图路径输入（F-52：本期不做上传，只填 /images/ 路径 + 实时预览）
 *
 * props：value, onChange(值), placeholder='/images/jiuzhaigou.jpg', label
 *   右侧 16:9 实时预览（onError 显示占位）+「使用内置图」快捷按钮（取自 constants.IMAGES）
 *
 * 用法：<ImagePathInput label="封面图路径" value={form.coverImage} onChange={(v) => setForm({...form, coverImage: v})} />
 */

import { useEffect, useState } from 'react';

import { IMAGES } from '../../lib/constants.js';
import FormField from './FormField.jsx';
import Input from './Input.jsx';

/** 内置图清单（键名即文件名） */
const BUILTIN = Object.keys(IMAGES).map((key) => ({ key, path: IMAGES[key] }));

/**
 * 封面图路径输入。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ImagePathInput({
  value = '',
  onChange,
  placeholder = '/images/jiuzhaigou.jpg',
  label = '',
  disabled = false,
  error = '',
}) {
  const path = value === null || value === undefined ? '' : String(value);
  const [failed, setFailed] = useState(false);

  // 路径变化时重置失败态，否则换图后仍显示占位
  useEffect(() => {
    setFailed(false);
  }, [path]);

  const body = (
    <div className="image-path">
      <div className="image-path__inputs">
        <Input
          value={path}
          onChange={(event) => {
            if (typeof onChange === 'function') onChange(event.target.value);
          }}
          placeholder={placeholder}
          disabled={disabled}
          error={Boolean(error)}
        />
        <div className="image-path__builtin">
          {BUILTIN.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip${path === item.path ? ' is-active' : ''}`}
              onClick={() => {
                if (typeof onChange === 'function') onChange(item.path);
              }}
              disabled={disabled}
            >
              {item.key}
            </button>
          ))}
        </div>
      </div>

      <div className="image-path__preview">
        {path && !failed ? (
          <img src={path} alt="封面预览" onError={() => setFailed(true)} />
        ) : (
          <div className="image-path__placeholder">{path ? '图片无法加载' : '封面预览 16:9'}</div>
        )}
      </div>
    </div>
  );

  if (!label) return body;

  return (
    <FormField label={label} error={error}>
      {body}
    </FormField>
  );
}

export default ImagePathInput;
