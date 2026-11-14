/**
 * P-24 修改密码（F-44）
 *
 * 路由：/admin/password（AdminLayout 内）
 * 接口：PUT /api/admin/auth/password { oldPassword, newPassword, confirmPassword }
 *       —— 由 useAdminAuth().changePassword 封装（成功后会清 admin token）
 *
 * 关键约定：
 * 1. 改密成功后本页必须主动跳 `/admin/login?reason=password-changed`（replace），
 *    因为后端没有 token 版本号，旧 token 在有效期内仍可用，只能靠前端强制重登；
 * 2. 失败 code 2005 → 「原密码不正确」钉在原密码字段下；
 * 3. 失败 code 1001 → 用 fieldErrors 回填表单。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FormShell from '../../components/admin/FormShell.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Input from '../../components/ui/Input.jsx';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ERROR_CODES } from '../../lib/api.js';
import { ROUTES } from '../../lib/constants.js';
import { RULES, mergeServerErrors, validateForm } from '../../lib/validate.js';

/** 表单初值 */
const EMPTY_VALUES = Object.freeze({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

/**
 * 修改密码页。
 * @returns {JSX.Element}
 */
export function PasswordChange() {
  const navigate = useNavigate();
  const { changePassword } = useAdminAuth();
  const { showToast } = useToast();

  const [values, setValues] = useState({ ...EMPTY_VALUES });
  const [errors, setErrors] = useState({});
  const [formAlert, setFormAlert] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * 字段变更（同时清掉该字段的旧错误）。
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

  /** 校验规则（新密码不得与原密码相同——DESIGN §7.4 之外的产品要求） */
  const schema = {
    oldPassword: [RULES.required('原密码')],
    newPassword: [
      RULES.required('新密码'),
      RULES.password('新密码'),
      (value) => (value && value === values.oldPassword ? '新密码不能与原密码相同' : null),
    ],
    confirmPassword: [RULES.confirmPassword('newPassword', '新密码')],
  };

  /**
   * 提交。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const result = validateForm(values, schema);
    if (!result.valid) {
      setErrors(result.errors);
      setFormAlert('');
      return;
    }

    setErrors({});
    setFormAlert('');
    setSaving(true);

    try {
      await changePassword(values.oldPassword, values.newPassword, values.confirmPassword);
      setSaving(false);
      showToast('密码已修改，请重新登录', 'success');
      navigate(`${ROUTES.ADMIN_LOGIN}?reason=password-changed`, { replace: true });
    } catch (error) {
      setSaving(false);
      const code = error ? error.code : ERROR_CODES.NETWORK;
      const message = (error && error.message) || '修改失败，请稍后重试';

      if (code === ERROR_CODES.OLD_PASSWORD_WRONG) {
        setErrors({ oldPassword: message || '原密码不正确' });
        setFormAlert(message || '原密码不正确');
        return;
      }
      if (error && error.fieldErrors) {
        setErrors(mergeServerErrors({}, error));
        setFormAlert(message);
        return;
      }
      if (code === ERROR_CODES.UNAUTHORIZED || code === ERROR_CODES.TOKEN_EXPIRED) {
        // token 已被 api.js 清除，守卫会接管跳转
        return;
      }
      setFormAlert(message);
    }
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={() => navigate(ROUTES.ADMIN_HOME)} disabled={saving}>
        取消
      </Button>
      <Button type="submit" loading={saving}>
        保存新密码
      </Button>
    </>
  );

  return (
    <form className="a-form" onSubmit={handleSubmit} noValidate>
      <FormShell
        title="修改密码"
        desc="修改成功后会自动退出登录，请使用新密码重新登录后台。"
        breadcrumb={[{ label: '管理后台', to: ROUTES.ADMIN_HOME }, { label: '修改密码' }]}
        footer={footer}
        hint="新密码 6–20 位，且不能与原密码相同"
      >
        {formAlert ? (
          <p className="form-alert" role="alert">
            {formAlert}
          </p>
        ) : null}

        <div className="form-shell__grid">
          <FormField label="原密码" required error={errors.oldPassword} htmlFor="oldPassword">
            <Input
              id="oldPassword"
              name="oldPassword"
              type="password"
              value={values.oldPassword}
              onChange={(event) => handleChange('oldPassword', event.target.value)}
              placeholder="请输入当前登录密码"
              autoComplete="current-password"
              autoFocus
            />
          </FormField>

          <FormField
            label="新密码"
            required
            error={errors.newPassword}
            htmlFor="newPassword"
            hint="6–20 位，建议字母与数字组合"
          >
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={values.newPassword}
              onChange={(event) => handleChange('newPassword', event.target.value)}
              placeholder="请输入新密码"
              autoComplete="new-password"
            />
          </FormField>

          <FormField label="确认新密码" required error={errors.confirmPassword} htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={values.confirmPassword}
              onChange={(event) => handleChange('confirmPassword', event.target.value)}
              placeholder="请再次输入新密码"
              autoComplete="new-password"
            />
          </FormField>
        </div>
      </FormShell>
    </form>
  );
}

export default PasswordChange;
