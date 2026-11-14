/**
 * P-22 游记新增 / 编辑（F-40、F-41）
 *
 * 路由：/admin/travels/new、/admin/travels/:id/edit
 * 接口：
 *   GET  /api/admin/options?type=scenics   → 所属景区下拉
 *   GET  /api/admin/travels/:id            → { travel }
 *   POST /api/admin/travels
 *   PUT  /api/admin/travels/:id            （编辑是 **PUT**，后端 travels.js 实现为 router.put）
 *
 * 约定：
 * - 标题 4–60 字；正文至少 50 字（后端下限 10，这里按 PRD 收紧），提交时按空行分段保存为 `\n\n`；
 * - 发布时间用 `<input type="date">`，提交转 ISO（本地时区当天 00:00）；
 * - 封面留空 → 后端自动回落到所属景区封面。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import FormShell from '../../components/admin/FormShell.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import ImagePathInput from '../../components/ui/ImagePathInput.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS } from '../../lib/constants.js';
import { get, post, put } from '../../lib/api.js';
import { formatDate, splitParagraphs } from '../../lib/format.js';
import { RULES, firstError, isEmptyValue, mergeServerErrors, validateForm } from '../../lib/validate.js';

/** 表单初值 */
const EMPTY_VALUES = Object.freeze({
  title: '',
  scenicId: '',
  authorName: '',
  publishedAt: '',
  coverImage: '',
  content: '',
});

/** 正文阈值（PRD：≥50 字） */
const CONTENT_MIN = 50;
const CONTENT_MAX = 5000;

/**
 * 构建封面校验规则：封面可留空（留空后端回落到景区封面）；
 * 填了则走 RULES.imagePath —— 编辑态传库里原值，值未变即放行（与后端 PUT 豁免同构）。
 *
 * @param {string|null} originalCover 编辑态的原封面（新增传 null）
 * @returns {(value: any) => string|null}
 */
function buildCoverRule(originalCover) {
  const strict = RULES.imagePath('封面图路径', { original: originalCover });
  return (value) => (isEmptyValue(value) ? null : strict(value));
}

/**
 * 游记表单页。
 * @returns {JSX.Element}
 */
export function TravelForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isEdit = Boolean(id);
  const listPath = '/admin/travels';

  const [values, setValues] = useState({ ...EMPTY_VALUES });
  const [originalCover, setOriginalCover] = useState(null);
  const [scenicOptions, setScenicOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [formAlert, setFormAlert] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  /** 景区下拉 */
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const data = await get(ADMIN_PATHS.OPTIONS, { scope: 'admin', query: { type: 'scenics' } });
      const raw = Array.isArray(data && data.list) ? data.list : [];
      setScenicOptions(
        raw.map((item) => ({
          value: item.value,
          label: item.extra ? `${item.label}（${item.extra}）` : item.label,
        })),
      );
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setScenicOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  /**
   * 编辑模式回填。
   * @returns {Promise<void>}
   */
  const loadDetail = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await get(`${ADMIN_PATHS.TRAVELS}/${id}`, { scope: 'admin' });
      const travel = data && data.travel ? data.travel : null;
      if (!travel) {
        setLoadError('没有找到该游记，可能已被删除');
        return;
      }
      setValues({
        title: travel.title || '',
        scenicId: travel.scenicId ? String(travel.scenicId) : '',
        authorName: travel.authorName || '',
        publishedAt: formatDate(travel.publishedAt),
        coverImage: travel.coverImage || '',
        content: travel.content || '',
      });
      // 记录原封面：供封面校验的编辑豁免使用（与后端 PUT 同构）
      setOriginalCover(travel.coverImage || '');
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setLoadError((err && err.message) || '游记信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  /**
   * 字段变更（清掉该字段错误）。
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

  const schema = {
    title: [RULES.lengthBetween(4, 60, '游记标题')],
    scenicId: [RULES.positiveInt('所属景区')],
    authorName: [RULES.maxLen(20, '作者名')],
    content: [RULES.lengthBetween(CONTENT_MIN, CONTENT_MAX, '正文')],
    coverImage: [buildCoverRule(isEdit ? originalCover : null)],
  };

  /**
   * 提交保存。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || loading) return;

    const result = validateForm(values, schema);
    if (!result.valid) {
      setErrors(result.errors);
      setFormAlert(firstError(result.errors));
      return;
    }

    // 正文按空行（或单换行）分段，统一以 \n\n 拼接交给后端
    const paragraphs = splitParagraphs(values.content);
    const content = paragraphs.join('\n\n');

    const payload = {
      title: values.title.trim(),
      scenicId: Number(values.scenicId),
      authorName: values.authorName.trim(),
      coverImage: values.coverImage.trim(),
      content,
      publishedAt: values.publishedAt ? new Date(`${values.publishedAt}T00:00:00`).toISOString() : '',
    };

    setErrors({});
    setFormAlert('');
    setSaving(true);
    try {
      if (isEdit) await put(`${ADMIN_PATHS.TRAVELS}/${id}`, payload, { scope: 'admin' });
      else await post(ADMIN_PATHS.TRAVELS, payload, { scope: 'admin' });

      setSaving(false);
      showToast(isEdit ? '游记已保存' : '游记已添加', 'success');
      navigate(listPath);
    } catch (err) {
      setSaving(false);
      if (err && (err.status === 401 || err.status === 403)) return;
      const message = (err && err.message) || '保存失败，请稍后重试';
      if (err && err.fieldErrors) setErrors(mergeServerErrors({}, err));
      setFormAlert(message);
    }
  };

  const paragraphCount = splitParagraphs(values.content).length;

  const footer = (
    <>
      <Button variant="ghost" onClick={() => navigate(listPath)} disabled={saving}>
        取消
      </Button>
      <Button type="submit" loading={saving} disabled={loading || Boolean(loadError)}>
        保存游记
      </Button>
    </>
  );

  if (loading) return <Spinner fullPage label="正在加载游记信息" />;

  return (
    <form className="a-form" onSubmit={handleSubmit} noValidate>
      <FormShell
        title={isEdit ? '编辑游记' : '新增游记'}
        desc="游记会按发布时间倒序展示在前台游记列表，并按景区归类到景区详情页。"
        breadcrumb={[{ label: '游记管理', to: listPath }, { label: isEdit ? '编辑' : '新增' }]}
        footer={footer}
        hint={`标题 4–60 字 · 正文至少 ${CONTENT_MIN} 字 · 当前 ${paragraphCount} 段`}
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
          <FormField label="游记标题" required error={errors.title} htmlFor="travel-title" hint="4–60 字">
            <Input
              id="travel-title"
              name="title"
              value={values.title}
              onChange={(event) => handleChange('title', event.target.value)}
              placeholder="例如：秋日九寨沟三天两晚慢游"
              maxLength={60}
              autoFocus
            />
          </FormField>

          <FormField label="所属景区" required error={errors.scenicId} htmlFor="travel-scenic">
            <Select
              id="travel-scenic"
              value={values.scenicId}
              onChange={(next) => handleChange('scenicId', next)}
              options={scenicOptions}
              placeholder={optionsLoading ? '景区加载中…' : '请选择所属景区'}
              disabled={optionsLoading || !scenicOptions.length}
              error={Boolean(errors.scenicId)}
            />
          </FormField>

          <FormField
            label="作者"
            error={errors.authorName}
            htmlFor="travel-author"
            hint="留空后端记为「站点编辑」；不超过 20 字"
          >
            <Input
              id="travel-author"
              name="authorName"
              value={values.authorName}
              onChange={(event) => handleChange('authorName', event.target.value)}
              placeholder="例如：林小满"
              maxLength={20}
            />
          </FormField>

          <FormField
            label="发布时间"
            error={errors.publishedAt}
            htmlFor="travel-published"
            hint="留空则使用当前时间；格式 YYYY-MM-DD"
          >
            <Input
              id="travel-published"
              name="publishedAt"
              type="date"
              value={values.publishedAt}
              onChange={(event) => handleChange('publishedAt', event.target.value)}
            />
          </FormField>

          <div className="form-shell__grid--full">
            <FormField
              label="封面图"
              error={errors.coverImage}
              hint="可留空，留空时自动使用所属景区封面；填写时请从本站 9 张素材中选择"
            >
              <ImagePathInput value={values.coverImage} onChange={(next) => handleChange('coverImage', next)} />
            </FormField>
          </div>

          <div className="form-shell__grid--full">
            <FormField
              label="正文"
              required
              error={errors.content}
              htmlFor="travel-content"
              hint={`至少 ${CONTENT_MIN} 字，最多 ${CONTENT_MAX} 字；用空行分段，保存时统一为段落分隔`}
            >
              <Textarea
                id="travel-content"
                name="content"
                rows={14}
                maxLength={CONTENT_MAX}
                value={values.content}
                onChange={(event) => handleChange('content', event.target.value)}
                placeholder={'第一段：出行时间与路线\n\n第二段：沿途风景与感受\n\n第三段：住宿与实用提示'}
              />
            </FormField>
          </div>
        </div>
      </FormShell>
    </form>
  );
}

export default TravelForm;
