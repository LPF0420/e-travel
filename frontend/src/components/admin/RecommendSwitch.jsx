/**
 * 推荐开关（DESIGN F-36：列表内直接切换 isRecommended，失败回滚 + Toast）
 *
 * props：scenicId, value, onChanged(nextValue, data)
 * 接口：PATCH /api/admin/scenics/:id/recommend { isRecommended: !value }
 *      返回 { id, isRecommended, recommendedTotal, warning? }，warning 存在时用 info Toast 提示。
 *
 * 用法：<RecommendSwitch scenicId={row.id} value={row.isRecommended} onChanged={(v) => updateRow(row.id, v)} />
 */

import { useEffect, useState } from 'react';

import { useToast } from '../../context/ToastContext.jsx';
import { patch } from '../../lib/api.js';

/**
 * 推荐开关。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function RecommendSwitch({ scenicId, value = false, onChanged }) {
  const { showToast } = useToast();
  const [on, setOn] = useState(Boolean(value));
  const [pending, setPending] = useState(false);

  // 列表重新拉取后同步外部值
  useEffect(() => {
    setOn(Boolean(value));
  }, [value, scenicId]);

  /**
   * 切换推荐状态。
   */
  const toggle = async () => {
    if (pending) return;
    const next = !on;
    setOn(next);
    setPending(true);

    try {
      const data = await patch(
        `/admin/scenics/${scenicId}/recommend`,
        { isRecommended: next },
        { scope: 'admin' },
      );
      const real = data && typeof data.isRecommended === 'boolean' ? data.isRecommended : next;
      setOn(real);
      if (typeof onChanged === 'function') onChanged(real, data);
      if (data && data.warning) showToast(data.warning, 'info');
      else showToast(real ? '已设为推荐' : '已取消推荐', 'success');
    } catch (error) {
      setOn(!next); // 回滚
      if (error && (error.status === 401 || error.status === 403)) return;
      showToast((error && error.message) || '操作失败，请稍后重试', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className={`switch${on ? ' is-on' : ''}${pending ? ' is-disabled' : ''}`}
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={on}
      title={on ? '点击取消推荐' : '点击设为推荐'}
    >
      <span className="switch__track">
        <span className="switch__knob" />
      </span>
      <span className="switch__label">{on ? '推荐中' : '推荐'}</span>
    </button>
  );
}

export default RecommendSwitch;
