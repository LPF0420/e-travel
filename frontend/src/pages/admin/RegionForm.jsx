/**
 * P-18 地区新增 / 编辑（F-31、F-32）
 *
 * 路由：/admin/regions/new（新增）、/admin/regions/:id/edit（编辑）；靠 useParams().id 区分
 * 接口：
 *   GET  /api/admin/regions/:id  → { region }
 *   POST /api/admin/regions      { name, description, coverImage, sortOrder }
 *   PUT  /api/admin/regions/:id  { name, description, coverImage, sortOrder }
 *   （注意：编辑是 **PUT**，后端 regions.js 实现为 router.put）
 *
 * 契约提示：后端地区模型只有 name/coverImage/description/sortOrder 四个可写字段，
 * 「是否首页推荐」不是可写字段——首页推荐位由 sortOrder 排序后取前 6 名推导（regionView.isHomeRecommended）。
 * 所以这里用**只读开关**展示当前状态 + 文案说明，避免出现「开关点了没效果」的假交互。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import FormShell from '../../components/admin/FormShell.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import ImagePathInput from '../../components/ui/ImagePathInput.jsx';
import Input from '../../components/ui/Input.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS } from '../../lib/constants.js';
import { get, post, put } from '../../lib/api.js';
import { RULES, firstError, mergeServerErrors, validateForm } from '../../lib/validate.js';

/** 表单初值 */
const EMPTY_VALUES = Object.freeze({
  name: '',
  description: '',
  coverImage: '',
  sortOrder: '',
});

/** 简介字数上限（后端 200） */
const DESC_MAX = 200;

/**
 * 构建校验规则（阈值与 server/routes/admin/regions.js 一致）。
 * 编辑态把库里原封面作为 `original` 传入：与后端 PUT 的豁免行为同构
 * （值未变则放行，只有改动后才校验是否在 9 张素材内），避免存量失效路径改不动其它字段。
 *
 * @param {string|null} originalCover 编辑态的原封面（新增传 null）
 * @returns {Record<string, Array<Function>>}
 */
function buildSchema(originalCover) {
  return {
    name: [RULES.lengthBetween(2, 20, '地区名称')],
    description: [RULES.maxLen(DESC_MAX, '地区简介')],
    coverImage: [RULES.imagePath('封面图路径', { original: originalCover })],
    sortOrder: [RULES.integer('排序值')],
  };
}

/**
 * 地区表单页。
 * @returns {JSX.Element}
 */
export function RegionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isEdit = Boolean(id);
  const listPath = '/admin/regions';

  const [values, setValues] = useState({ ...EMPTY_VALUES });
  const [originalCover, setOriginalCover] = useState(null);
  const [isHomeRecommended, setIsHomeRecommended] = useState(false);
  const [errors, setErrors] = useState({});
  const [formAlert, setFormAlert] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  /**
   * 编辑模式：回填表单。
   * @returns {Promise<void>}
   */
  const loadDetail = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await get(`${ADMIN_PATHS.REGIONS}/${id}`, { scope: 'admin' });
      const region = data && data.region ? data.region : null;
      if (!region) {
        setLoadError('没有找到该地区，可能已被删除');
        return;
      }
      setValues({
        name: region.name || '',
        description: region.description || '',
        coverImage: region.coverImage || '',
        sortOrder: region.sortOrder === 0 || region.sortOrder ? String(region.sortOrder) : '',
      });
      // 记录原封面：供 imagePath 的编辑豁免使用（与后端 PUT 同构）
      setOriginalCover(region.coverImage || '');
      setIsHomeRecommended(Boolean(region.isHomeRecommended));
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setLoadError((err && err.message) || '地区信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  /**
   * 字段变更。
   * @param {string} field
   * @param {string} next
   */
  const handleChange = (field, next) => {
    setValues((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const cloned = { ...prev };
      delete cloned[field];
      return cloned;
    });
  };

  /**
   * 提交保存。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || loading) return;

    const result = validateForm(values, buildSchema(isEdit ? originalCover : null));
    if (!result.valid) {
      setErrors(result.errors);
      setFormAlert(firstError(result.errors));
      return;
    }

    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      coverImage: values.coverImage.trim(),
      sortOrder: values.sortOrder === '' ? 0 : Number(values.sortOrder),
    };

    setErrors({});
    setFormAlert('');
    setSaving(true);
    try {
      if (isEdit) await put(`${ADMIN_PATHS.REGIONS}/${id}`, payload, { scope: 'admin' });
      else await post(ADMIN_PATHS.REGIONS, payload, { scope: 'admin' });

      setSaving(false);
      showToast(isEdit ? '地区已保存' : '地区已添加', 'success');
      navigate(listPath);
    } catch (err) {
      setSaving(false);
      if (err && (err.status === 401 || err.status === 403)) return;
      const message = (err && err.message) || '保存失败，请稍后重试';
      if (err && err.fieldErrors) {
        setErrors(mergeServerErrors({}, err));
      }
      setFormAlert(message);
    }
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={() => navigate(listPath)} disabled={saving}>
        取消
      </Button>
      <Button type="submit" loading={saving} disabled={loading || Boolean(loadError)}>
        保存地区
      </Button>
    </>
  );

  if (loading) return <Spinner fullPage label="正在加载地区信息" />;

  return (
    <form className="a-form" onSubmit={handleSubmit} noValidate>
      <FormShell
        title={isEdit ? '编辑地区' : '新增地区'}
        desc="地区用于给景区归类，并作为首页「热门目的地」卡片展示。"
        breadcrumb={[{ label: '地区管理', to: listPath }, { label: isEdit ? '编辑' : '新增' }]}
        footer={footer}
        hint="地区名称 2–20 字，简介最多 200 字"
      >
        {loadError ? (
          <p className="form-alert" role="alert">
            {loadError}
          </p>
        ) : null}

        {formAlert ? (
          <p className="form-alert" role="alert">
            {formAlert}
          </p>
        ) : null}

        <div className="form-shell__grid">
          <FormField label="地区名称" required error={errors.name} htmlFor="region-name" hint="2–20 字，不可与已有地区重名">
            <Input
              id="region-name"
              name="name"
              value={values.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="例如：四川"
              maxLength={20}
              autoFocus
            />
          </FormField>

          <FormField
            label="排序值"
            error={errors.sortOrder}
            htmlFor="region-sort"
            hint="整数，越大越靠前；前 6 名进入首页推荐位"
          >
            <Input
              id="region-sort"
              name="sortOrder"
              type="number"
              value={values.sortOrder}
              onChange={(event) => handleChange('sortOrder', event.target.value)}
              placeholder="例如：100"
            />
          </FormField>

          <FormField
            label="首页推荐位"
            hint="由排序值决定：排序值前 6 个地区自动进入首页推荐，无需单独设置"
          >
            <button
              type="button"
              className={`switch${isHomeRecommended ? ' is-on' : ''} is-disabled`}
              role="switch"
              aria-checked={isHomeRecommended}
              aria-readonly="true"
              disabled
              title="由排序值自动决定，不可单独切换"
            >
              <span className="switch__track">
                <span className="switch__knob" />
              </span>
              <span className="switch__label">{isHomeRecommended ? '首页展示中' : '未进入首页'}</span>
            </button>
          </FormField>

          <FormField
            label="地区简介"
            error={errors.description}
            htmlFor="region-desc"
            hint={`最多 ${DESC_MAX} 字，用于地区卡片简介`}
          >
            <Textarea
              id="region-desc"
              name="description"
              rows={4}
              maxLength={DESC_MAX}
              value={values.description}
              onChange={(event) => handleChange('description', event.target.value)}
              placeholder="一句话介绍这个地区的风景与特色"
            />
          </FormField>

          <div className="form-shell__grid--full">
            <FormField
              label="封面图"
              required
              error={errors.coverImage}
              hint="请从本站 9 张内置素材中选择（路径以 /images/ 开头）"
            >
              <ImagePathInput value={values.coverImage} onChange={(next) => handleChange('coverImage', next)} />
            </FormField>
          </div>
        </div>
      </FormShell>
    </form>
  );
}

export default RegionForm;
