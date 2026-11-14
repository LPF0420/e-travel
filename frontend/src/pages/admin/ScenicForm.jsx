/**
 * P-20 景区新增 / 编辑（F-37、F-38）
 *
 * 路由：/admin/scenics/new、/admin/scenics/:id/edit
 * 接口：
 *   GET  /api/admin/options?type=regions   → 地区下拉（为空说明还没建地区，禁止提交）
 *   GET  /api/admin/scenics/:id            → { scenic, travelCount, favoriteCount }
 *   POST /api/admin/scenics
 *   PUT  /api/admin/scenics/:id            （编辑是 **PUT**）
 *
 * 布局（DESIGN §6.2）：两栏 —— 左基本信息 / 右封面·图集·看点，下方通栏简介与交通信息。
 * 校验阈值与 server/routes/admin/scenics.js 一致：名称 2–50、简介 ≥10 且 ≤500、评分 0–5、
 * 图集每项以 /images/ 开头（最多 5 张）、单个看点 ≤20 字。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import FormShell from '../../components/admin/FormShell.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import GalleryPathInput from '../../components/ui/GalleryPathInput.jsx';
import ImagePathInput from '../../components/ui/ImagePathInput.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_PATHS, IMAGE_PATHS, IMAGE_PATH_PREFIX, SCENIC_LEVELS } from '../../lib/constants.js';
import { get, post, put } from '../../lib/api.js';
import { RULES, firstError, mergeServerErrors, validateForm } from '../../lib/validate.js';

/** 表单初值 */
const EMPTY_VALUES = Object.freeze({
  name: '',
  regionId: '',
  level: '',
  rating: '',
  ticketPrice: '',
  openTime: '',
  bestSeason: '',
  isRecommended: false,
  coverImage: '',
  gallery: [],
  highlights: [],
  description: '',
  traffic: '',
});

/** 简介 / 交通字数上限 */
const DESC_MAX = 500;
const TRAFFIC_MAX = 200;
/** 图集上限（PRD：最多 5 张） */
const GALLERY_MAX = 5;
/** 单个看点上限定 */
const HIGHLIGHT_MAX = 20;

/** 等级下拉（空位表示未评级） */
const LEVEL_OPTIONS = SCENIC_LEVELS.map((level) => ({ value: level, label: level }));

/**
 * 构建图集校验规则。
 *
 * 与后端 scenics.js 完全同构：图集数组「有变化」时每一项都必须是本站可用素材，
 * 与库里原图集完全一致时整体放行（历史失效路径不会卡住其它字段的编辑）。
 *
 * @param {string[]|null} originalGallery 编辑态的原图集（新增传 null）
 * @returns {(value: any) => string|null}
 */
function buildGalleryRule(originalGallery) {
  const originals = Array.isArray(originalGallery)
    ? originalGallery.map((item) => String(item || '').trim()).filter(Boolean)
    : null;

  return (value) => {
    const list = (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean);
    if (list.length > GALLERY_MAX) return `图集最多 ${GALLERY_MAX} 张，当前 ${list.length} 张`;
    if (list.some((item) => !item.startsWith(IMAGE_PATH_PREFIX))) {
      return `图集每一项都需以 ${IMAGE_PATH_PREFIX} 开头`;
    }

    // 未改动 → 放行（编辑豁免）
    const unchanged = originals !== null && originals.length === list.length && originals.every((item, i) => item === list[i]);
    if (unchanged) return null;

    // 有改动 → 每一项都必须是本站 9 张素材之一
    const invalidIndex = list.findIndex((item) => !IMAGE_PATHS.includes(item));
    if (invalidIndex >= 0) {
      return `第 ${invalidIndex + 1} 张不在可用素材里，请从本站 9 张图片中选`;
    }
    return null;
  };
}

/**
 * 校验看点：单个不超过 20 字。
 * @param {string[]} value
 * @returns {string|null}
 */
function validateHighlights(value) {
  const list = (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean);
  if (list.some((item) => item.length > HIGHLIGHT_MAX)) return `单个看点不超过 ${HIGHLIGHT_MAX} 字`;
  return null;
}

/**
 * 景区表单页。
 * @returns {JSX.Element}
 */
export function ScenicForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isEdit = Boolean(id);
  const listPath = '/admin/scenics';

  const [values, setValues] = useState({ ...EMPTY_VALUES });
  const [originalCover, setOriginalCover] = useState(null);
  const [originalGallery, setOriginalGallery] = useState(null);
  const [regionOptions, setRegionOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [formAlert, setFormAlert] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  /** 地区下拉（决定能否提交） */
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const data = await get(ADMIN_PATHS.OPTIONS, { scope: 'admin', query: { type: 'regions' } });
      setRegionOptions(Array.isArray(data && data.list) ? data.list : []);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setRegionOptions([]);
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
      const data = await get(`${ADMIN_PATHS.SCENICS}/${id}`, { scope: 'admin' });
      const scenic = data && data.scenic ? data.scenic : null;
      if (!scenic) {
        setLoadError('没有找到该景区，可能已被删除');
        return;
      }
      setValues({
        name: scenic.name || '',
        regionId: scenic.regionId ? String(scenic.regionId) : '',
        level: scenic.level || '',
        rating: scenic.rating === 0 || scenic.rating ? String(scenic.rating) : '',
        ticketPrice: scenic.ticketPrice || '',
        openTime: scenic.openTime || '',
        bestSeason: scenic.bestSeason || '',
        isRecommended: Boolean(scenic.isRecommended),
        coverImage: scenic.coverImage || '',
        gallery: Array.isArray(scenic.gallery) ? scenic.gallery.slice(0, GALLERY_MAX) : [],
        highlights: Array.isArray(scenic.highlights) ? scenic.highlights : [],
        description: scenic.description || '',
        traffic: scenic.traffic || '',
      });
      // 记录原封面/原图集：供 imagePath / 图集校验的编辑豁免使用（与后端 PUT 同构）
      setOriginalCover(scenic.coverImage || '');
      setOriginalGallery(Array.isArray(scenic.gallery) ? scenic.gallery : []);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setLoadError((err && err.message) || '景区信息加载失败，请稍后重试');
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
   * 字段变更（并清掉该字段错误）。
   * @param {string} field
   * @param {any} next
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
   * 看点行修改。
   * @param {number} index
   * @param {string} next
   */
  const updateHighlight = (index, next) => {
    const list = values.highlights.slice();
    list[index] = next;
    handleChange('highlights', list);
  };

  /**
   * 删除看点行。
   * @param {number} index
   */
  const removeHighlight = (index) => {
    handleChange(
      'highlights',
      values.highlights.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  /** 追加看点行 */
  const addHighlight = () => {
    handleChange('highlights', [...values.highlights, '']);
  };

  const schema = {
    name: [RULES.lengthBetween(2, 50, '景区名称')],
    regionId: [RULES.positiveInt('所属地区')],
    // 编辑态传库里原封面 → 值未变则放行（后端 PUT 同款豁免）
    coverImage: [RULES.imagePath('封面图路径', { original: isEdit ? originalCover : null })],
    description: [RULES.lengthBetween(10, DESC_MAX, '景区简介')],
    rating: [RULES.rating('评分')],
    openTime: [RULES.maxLen(50, '开放时间')],
    ticketPrice: [RULES.maxLen(50, '门票参考')],
    bestSeason: [RULES.maxLen(30, '最佳季节')],
    traffic: [RULES.maxLen(TRAFFIC_MAX, '交通信息')],
    level: [RULES.maxLen(10, '景区等级')],
    gallery: [buildGalleryRule(isEdit ? originalGallery : null)],
    highlights: [validateHighlights],
  };

  /**
   * 提交保存。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || loading) return;

    if (!regionOptions.length) {
      setFormAlert('还没有地区，请先新增地区后再添加景区');
      return;
    }

    const result = validateForm(values, schema);
    if (!result.valid) {
      setErrors(result.errors);
      setFormAlert(firstError(result.errors));
      return;
    }

    const payload = {
      name: values.name.trim(),
      regionId: Number(values.regionId),
      level: values.level.trim(),
      rating: values.rating === '' ? null : Number(values.rating),
      ticketPrice: values.ticketPrice.trim(),
      openTime: values.openTime.trim(),
      bestSeason: values.bestSeason.trim(),
      isRecommended: Boolean(values.isRecommended),
      coverImage: values.coverImage.trim(),
      gallery: values.gallery.map((item) => String(item || '').trim()).filter(Boolean),
      highlights: values.highlights.map((item) => String(item || '').trim()).filter(Boolean),
      description: values.description.trim(),
      traffic: values.traffic.trim(),
    };

    setErrors({});
    setFormAlert('');
    setSaving(true);
    try {
      if (isEdit) await put(`${ADMIN_PATHS.SCENICS}/${id}`, payload, { scope: 'admin' });
      else await post(ADMIN_PATHS.SCENICS, payload, { scope: 'admin' });

      setSaving(false);
      showToast(isEdit ? '景区已保存' : '景区已添加', 'success');
      navigate(listPath);
    } catch (err) {
      setSaving(false);
      if (err && (err.status === 401 || err.status === 403)) return;
      const message = (err && err.message) || '保存失败，请稍后重试';
      if (err && err.fieldErrors) setErrors(mergeServerErrors({}, err));
      setFormAlert(message);
    }
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={() => navigate(listPath)} disabled={saving}>
        取消
      </Button>
      <Button type="submit" loading={saving} disabled={loading || Boolean(loadError) || !regionOptions.length}>
        保存景区
      </Button>
    </>
  );

  if (loading) return <Spinner fullPage label="正在加载景区信息" />;

  return (
    <form className="a-form" onSubmit={handleSubmit} noValidate>
      <FormShell
        wide
        title={isEdit ? '编辑景区' : '新增景区'}
        desc="景区是前台内容的核心，封面、图集、看点与交通信息会直接影响详情页展示效果。"
        breadcrumb={[{ label: '景区管理', to: listPath }, { label: isEdit ? '编辑' : '新增' }]}
        footer={footer}
        hint={`名称 2–50 字 · 简介 ${DESC_MAX} 字内 · 图集最多 ${GALLERY_MAX} 张`}
      >
        {regionOptions.length === 0 && !optionsLoading ? (
          <div className="inline-alert" role="alert">
            <span>还没有地区，请先新增地区后再添加景区（景区必须归属某个地区）。</span>
            <Button size="sm" onClick={() => navigate('/admin/regions/new')}>
              去新增地区
            </Button>
          </div>
        ) : null}

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
          {/* ---------- 左栏：基本信息 ---------- */}
          <section className="a-form__section">
            <h2 className="a-form__section-title">基本信息</h2>

            <FormField label="景区名称" required error={errors.name} htmlFor="scenic-name" hint="2–50 字">
              <Input
                id="scenic-name"
                name="name"
                value={values.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="例如：九寨沟"
                maxLength={50}
                autoFocus
              />
            </FormField>

            <FormField label="所属地区" required error={errors.regionId} htmlFor="scenic-region">
              <Select
                id="scenic-region"
                value={values.regionId}
                onChange={(next) => handleChange('regionId', next)}
                options={regionOptions}
                placeholder={optionsLoading ? '地区加载中…' : '请选择所属地区'}
                disabled={optionsLoading || !regionOptions.length}
                error={Boolean(errors.regionId)}
              />
            </FormField>

            <FormField label="景区等级" error={errors.level} htmlFor="scenic-level" hint="不选表示未评级">
              <Select
                id="scenic-level"
                value={values.level}
                onChange={(next) => handleChange('level', next)}
                options={LEVEL_OPTIONS}
                placeholder="未评级"
                error={Boolean(errors.level)}
              />
            </FormField>

            <FormField label="评分" error={errors.rating} htmlFor="scenic-rating" hint="0–5，可留空；前台显示 1 位小数">
              <Input
                id="scenic-rating"
                name="rating"
                type="number"
                value={values.rating}
                onChange={(event) => handleChange('rating', event.target.value)}
                placeholder="例如：4.8"
                step="0.1"
                min="0"
                max="5"
              />
            </FormField>

            <FormField label="门票参考" error={errors.ticketPrice} htmlFor="scenic-ticket" hint="50 字内，例如「190 元」或「免费」">
              <Input
                id="scenic-ticket"
                name="ticketPrice"
                value={values.ticketPrice}
                onChange={(event) => handleChange('ticketPrice', event.target.value)}
                placeholder="例如：190 元"
                maxLength={50}
              />
            </FormField>

            <FormField label="开放时间" error={errors.openTime} htmlFor="scenic-open" hint="50 字内">
              <Input
                id="scenic-open"
                name="openTime"
                value={values.openTime}
                onChange={(event) => handleChange('openTime', event.target.value)}
                placeholder="例如：07:00–18:00（旺季）"
                maxLength={50}
              />
            </FormField>

            <FormField label="最佳季节" error={errors.bestSeason} htmlFor="scenic-season" hint="30 字内">
              <Input
                id="scenic-season"
                name="bestSeason"
                value={values.bestSeason}
                onChange={(event) => handleChange('bestSeason', event.target.value)}
                placeholder="例如：9–11 月"
                maxLength={30}
              />
            </FormField>

            <FormField label="首页推荐" hint="开启后优先出现在首页推荐位与「编辑推荐」排序中">
              <button
                type="button"
                className={`switch${values.isRecommended ? ' is-on' : ''}`}
                role="switch"
                aria-checked={Boolean(values.isRecommended)}
                onClick={() => handleChange('isRecommended', !values.isRecommended)}
              >
                <span className="switch__track">
                  <span className="switch__knob" />
                </span>
                <span className="switch__label">{values.isRecommended ? '推荐中' : '推荐'}</span>
              </button>
            </FormField>
          </section>

          {/* ---------- 右栏：图片与看点 ---------- */}
          <section className="a-form__section">
            <h2 className="a-form__section-title">图片与看点</h2>

            <FormField label="封面图" required error={errors.coverImage} hint="请从本站 9 张内置素材中选择（路径以 /images/ 开头）">
              <ImagePathInput value={values.coverImage} onChange={(next) => handleChange('coverImage', next)} />
            </FormField>

            <FormField
              label="景区图集"
              error={errors.gallery}
              hint={`最多 ${GALLERY_MAX} 张，需从本站 9 张素材中选（路径以 /images/ 开头）`}
            >
              <GalleryPathInput
                value={values.gallery}
                onChange={(next) => handleChange('gallery', next)}
                max={GALLERY_MAX}
              />
            </FormField>

            <FormField label="景区看点" error={errors.highlights} hint={`每条 ${HIGHLIGHT_MAX} 字内，可增删多条`}>
              <div className="a-highlight">
                {values.highlights.length === 0 ? (
                  <p className="a-highlight__empty">还没有看点，点下方按钮添加，例如「五花海」「诺日朗瀑布」</p>
                ) : null}

                {values.highlights.map((item, index) => (
                  <div className="a-highlight__row" key={`highlight-${index}`}>
                    <span className="a-highlight__index">{index + 1}</span>
                    <Input
                      value={item}
                      onChange={(event) => updateHighlight(index, event.target.value)}
                      placeholder="填写一个看点"
                      maxLength={HIGHLIGHT_MAX}
                    />
                    <Button size="sm" variant="text" className="a-btn-danger" onClick={() => removeHighlight(index)}>
                      删除
                    </Button>
                  </div>
                ))}

                <div>
                  <Button size="sm" variant="ghost" onClick={addHighlight}>
                    添加看点
                  </Button>
                </div>
              </div>
            </FormField>
          </section>

          {/* ---------- 通栏：简介与交通 ---------- */}
          <section className="a-form__section form-shell__grid--full">
            <h2 className="a-form__section-title">详情内容</h2>

            <FormField
              label="景区简介"
              required
              error={errors.description}
              htmlFor="scenic-desc"
              hint={`至少 10 字、最多 ${DESC_MAX} 字`}
            >
              <Textarea
                id="scenic-desc"
                name="description"
                rows={8}
                maxLength={DESC_MAX}
                value={values.description}
                onChange={(event) => handleChange('description', event.target.value)}
                placeholder="介绍景区特色、最佳游览路线与注意事项"
              />
            </FormField>

            <FormField
              label="交通信息"
              error={errors.traffic}
              htmlFor="scenic-traffic"
              hint={`${TRAFFIC_MAX} 字内，例如自驾/动车/景区内交通`}
            >
              <Textarea
                id="scenic-traffic"
                name="traffic"
                rows={4}
                maxLength={TRAFFIC_MAX}
                value={values.traffic}
                onChange={(event) => handleChange('traffic', event.target.value)}
                placeholder="说明如何到达景区，以及景区内部交通方式"
              />
            </FormField>
          </section>
        </div>
      </FormShell>
    </form>
  );
}

export default ScenicForm;
