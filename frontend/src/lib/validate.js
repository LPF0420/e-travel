/**
 * 表单校验（DESIGN §7.4：阈值与后端 server/utils.js 完全一致，避免前端放过、后端 400）
 *
 * 用法：
 *   const schema = {
 *     username: [RULES.required('会员名'), RULES.username()],
 *     password: [RULES.required('密码'), RULES.password()],
 *     confirmPassword: [RULES.confirmPassword('password')],
 *   };
 *   const { valid, errors } = validateForm(values, schema);   // errors 形如 { username: '...' }
 *
 * 兼容两种取值习惯：`result.errors.username` 与 `result.username` 都拿得到同一条文案
 * （DESIGN 写 { valid, errors }，页面直接用扁平结构更省事，故两者同时提供；字段名不叫 valid/errors 时不冲突）。
 */

import { IMAGE_PATHS, IMAGE_PATH_PREFIX, IMAGES } from './constants.js';

/** 空值判定：null / undefined / 空串 / 纯空白 */
export function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim() === '';
}

/** 统一取字符串（数字会转字符串，便于长度校验） */
function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/* ============================================================
 * 原子校验器（返回 boolean）
 * ============================================================ */

/** 会员名：2–20 字，允许中文 / 字母 / 数字 / 下划线 */
export function isUsername(value) {
  return /^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/.test(toText(value));
}

/** 密码：6–20 位（不限制字符类型，DESIGN §7.4） */
export function isPassword(value) {
  const text = typeof value === 'string' ? value : toText(value);
  return text.length >= 6 && text.length <= 20;
}

/** 中国大陆手机号：11 位，1[3-9] 开头 */
export function isPhone(value) {
  return /^1[3-9]\d{9}$/.test(toText(value));
}

/** 邮箱 */
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toText(value));
}

/** 图片路径：必须以 /images/ 开头（本期不做上传，见 PRD C-06） */
export function isImagePath(value) {
  return toText(value).startsWith('/images/');
}

/** 正整数 id（regionId / scenicId / 后台主键） */
export function isPositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/** 字符串长度在 [min, max] 之间（按 trim 后计算） */
export function isLengthBetween(value, min, max) {
  const length = toText(value).length;
  return length >= min && length <= max;
}

/** 图集张数上限：与后端 `normalizeStringList(value, { maxItems: 6 })` 保持一致 */
export const GALLERY_MAX = 6;

/**
 * 归一化图片列表：数组或「逗号 / 中文逗号 / 换行」分隔的字符串 → 去空、去首尾空白、按首次出现去重。
 * 与后端 `normalizeStringList` 完全同口径（后端也会去重并截断到 maxItems），
 * 这样「前端判定未变化」与「后端判定 galleryChanged=false」才不会不一致。
 *
 * @param {string[]|string|null|undefined} value
 * @returns {string[]}
 */
export function normalizeImageList(value) {
  let raw = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string') raw = value.split(/[,，\n\r]+/);
  else if (value === null || value === undefined) raw = [];
  else raw = [String(value)];

  const seen = new Set();
  const list = [];
  raw.forEach((item) => {
    const text = toText(item);
    if (!text || seen.has(text)) return;
    seen.add(text);
    list.push(text);
  });
  return list;
}

/* ============================================================
 * 规则工厂（返回 (value, values) => string|null，返回首个错误文案）
 * ============================================================ */

export const RULES = {
  /**
   * 必填。
   * @param {string} label 中文字段名，用于文案
   */
  required(label = '该项') {
    return (value) => (isEmptyValue(value) ? `请填写${label}` : null);
  },

  /** 会员名：2–20 字 */
  username(label = '会员名') {
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      if (!isUsername(value)) return `${label}需为 2–20 字，可用中文、字母、数字或下划线`;
      return null;
    };
  },

  /** 密码：6–20 位 */
  password(label = '密码') {
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      if (!isPassword(value)) return `${label}至少 6 位、最多 20 位，建议字母加数字`;
      return null;
    };
  },

  /**
   * 确认密码：与指定字段严格相等。
   * @param {string} [passwordField='password'] 被比对的字段名
   */
  confirmPassword(passwordField = 'password', label = '确认密码') {
    return (value, values) => {
      if (isEmptyValue(value)) return `请再次输入${label}`;
      if (value !== (values || {})[passwordField]) return '两次输入的密码不一致，请重新输入';
      return null;
    };
  },

  /** 手机号 */
  phone(label = '手机号') {
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      if (!isPhone(value)) return `请输入 11 位有效手机号，例如 13800138000`;
      return null;
    };
  },

  /** 邮箱 */
  email(label = '邮箱') {
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      if (!isEmail(value)) return `请输入有效的邮箱地址，例如 name@example.com`;
      return null;
    };
  },

  /** 最大长度 */
  maxLen(max, label = '该项') {
    return (value) => {
      if (isEmptyValue(value)) return null;
      const length = toText(value).length;
      if (length > max) return `${label}最多 ${max} 个字，当前 ${length} 个`;
      return null;
    };
  },

  /** 最小长度 */
  minLen(min, label = '该项') {
    return (value) => {
      if (isEmptyValue(value)) return null;
      const length = toText(value).length;
      if (length < min) return `${label}至少 ${min} 个字，当前 ${length} 个`;
      return null;
    };
  },

  /** 长度区间（简介/正文/留言内容） */
  lengthBetween(min, max, label = '内容') {
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      const length = toText(value).length;
      if (length < min) return `${label}太短了，请至少输入 ${min} 个字`;
      if (length > max) return `${label}最多 ${max} 个字，当前 ${length} 个`;
      return null;
    };
  },

  /**
   * 图片路径：必填、以 /images/ 开头，并在本地 `IMAGE_PATHS`（9 张真实素材）里做一次存在性预校验。
   *
   * 与后端 `isAvailableImagePath()` 的**口径对齐**：
   * - 后端在 `PUT` 编辑时对「提交值 === 库里原值」有豁免（跳过存在性校验，只判前缀），
   *   以免历史遗留的失效路径（如早年的 .png 引用）导致该记录永远改不动；
   * - 前端保持一致：传入 `options.original`（编辑态回填的原始封面值）后，值未变化时直接放行；
   *   值一旦变化就走完整校验；`POST` 新增不传 original，即严格校验（不要放宽）。
   *
   * 素材实际扩展名是 **.jpg**（不是 .png），示例文案统一取自 constants.IMAGES，避免文案与素材漂移。
   *
   * @param {string} [label='封面图路径']
   * @param {{ original?: string|null }} [options] 编辑态传 { original: 记录原值 }
   */
  imagePath(label = '封面图路径', options = {}) {
    const original = options && options.original !== undefined ? options.original : null;
    return (value) => {
      if (isEmptyValue(value)) return `请填写${label}`;
      const text = toText(value);
      if (!isImagePath(text)) {
        return `请填写 ${IMAGE_PATH_PREFIX} 下的图片路径，例如 ${IMAGES.jiuzhaigou}`;
      }
      // 编辑豁免：与后端一致，原样保留不校验存在性（历史数据可正常保存）
      if (original !== null && text === toText(original)) return null;
      if (IMAGE_PATHS.length > 0 && !IMAGE_PATHS.includes(text)) {
        return `这张图不在可用素材里，请从本站 9 张图片中选（如 ${IMAGES.jiuzhaigou}）`;
      }
      return null;
    };
  },

  /**
   * 图集（多图）路径校验：张数上限 + 每一项前缀/存在性 + **整数组编辑豁免**。
   *
   * 与后端 `routes/admin/scenics.js` 同口径：
   * - 后端先 `normalizeStringList(...)`（去重、截断到 6），再算 `galleryChanged = 长度或任一位不同`，
   *   **只有 changed 时**才对每一项跑 `isAvailableImagePath()`；
   * - 所以这里：归一化后与新值比对，**数组完全一致（含顺序）→ 放行**；有任何增删改 → 每一项都要过校验。
   *   这样存量记录即便带失效图（如早年 .png）也能正常改标题/简介。
   *
   * @param {number} [max=GALLERY_MAX] 允许的最大张数（后端 maxItems=6）
   * @param {{ original?: string[]|string|null, label?: string, required?: boolean }} [options]
   *        original：编辑态回填的原始图集；required：是否至少 1 张（新增景区默认 false，与后端一致）
   */
  galleryImages(max = GALLERY_MAX, options = {}) {
    const { original = null, label = '图集', required = false } = options || {};
    return (value) => {
      const list = normalizeImageList(value);
      if (list.length === 0) return required ? `请至少添加一张${label}图片` : null;
      if (list.length > max) return `${label}最多 ${max} 张，当前 ${list.length} 张，请删掉多余的`;

      // 编辑豁免：归一化后与原数组逐位相同 → 视为未改动，跳过存在性校验
      const origin = original === null || original === undefined ? null : normalizeImageList(original);
      if (origin && list.length === origin.length && list.every((item, index) => item === origin[index])) {
        return null;
      }

      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        if (!isImagePath(item)) {
          return `第 ${index + 1} 张需以 ${IMAGE_PATH_PREFIX} 开头，例如 ${IMAGES.jiuzhaigou}`;
        }
        if (IMAGE_PATHS.length > 0 && !IMAGE_PATHS.includes(item)) {
          return `第 ${index + 1} 张不在可用素材里，请从本站 9 张图片中选（如 ${IMAGES.jiuzhaigou}）`;
        }
      }
      return null;
    };
  },

  /** 必选 id（地区/景区下拉） */
  positiveInt(label = '该项') {
    return (value) => {
      if (isEmptyValue(value)) return `请选择${label}`;
      if (!isPositiveInt(value)) return `${label}不合法，请重新选择`;
      return null;
    };
  },

  /** 整数（允许负数，用于 sortOrder） */
  integer(label = '该项') {
    return (value) => {
      if (isEmptyValue(value)) return null;
      if (!/^-?\d+$/.test(toText(value))) return `${label}需为整数，可有负号`;
      return null;
    };
  },

  /** 评分：0–5，允许一位小数 */
  rating(label = '评分') {
    return (value) => {
      if (isEmptyValue(value)) return null;
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0 || num > 5) return `${label}需在 0–5 之间`;
      return null;
    };
  },
};

/* ============================================================
 * 表单级校验
 * ============================================================ */

/**
 * 逐字段跑规则，每条规则返回第一条错误即停。
 *
 * @param {Record<string, any>} values 表单当前值
 * @param {Record<string, Array<(value:any, values:object)=>string|null>|function>} schema 字段 → 规则（或规则数组）
 * @returns {{ valid: boolean, errors: Record<string,string> } & Record<string, any>}
 *          同时把 errors 的键扁平挂到返回对象上，页面可写 `errors.username` 或 `result.username`
 */
export function validateForm(values, schema) {
  const source = values || {};
  const errors = {};
  Object.keys(schema || {}).forEach((field) => {
    const rules = Array.isArray(schema[field]) ? schema[field] : [schema[field]];
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (typeof rule !== 'function') continue;
      const message = rule(source[field], source);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  });

  const result = { valid: Object.keys(errors).length === 0, errors };
  Object.keys(errors).forEach((field) => {
    if (field === 'valid' || field === 'errors') return;
    result[field] = errors[field];
  });
  return result;
}

/**
 * 合并后端字段级错误（ApiError.fieldErrors，code 1001/1003 时可用）到本地 errors，
 * 供表单在提交失败后把服务端文案直接显示到对应输入框下。
 *
 * @param {Record<string,string>} localErrors
 * @param {import('./api.js').ApiError|{ fieldErrors?: Record<string,string>|null, data?: any }|null} apiError
 * @returns {Record<string,string>} 新的合并对象（不改动入参）
 */
export function mergeServerErrors(localErrors, apiError) {
  const merged = { ...(localErrors || {}) };
  const fieldErrors = apiError && apiError.fieldErrors ? apiError.fieldErrors : null;
  if (!fieldErrors || typeof fieldErrors !== 'object') return merged;
  Object.keys(fieldErrors).forEach((field) => {
    if (fieldErrors[field]) merged[field] = String(fieldErrors[field]);
  });
  return merged;
}

/**
 * 取第一条错误文案（表单顶部 .form-alert 用）。
 * @param {Record<string,string>} errors
 * @returns {string}
 */
export function firstError(errors) {
  const keys = Object.keys(errors || {});
  return keys.length ? errors[keys[0]] : '';
}
