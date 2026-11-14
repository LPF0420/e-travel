/**
 * P-12 管理员登录（F-23）
 *
 * 路由：/admin/login（**裸路由**，不套 AdminLayout/AdminRoute）
 * 接口：POST /api/admin/auth/login { username, password } —— 由 useAdminAuth().login 封装
 *
 * 行为要点：
 * 1. 深青绿底 + 居中白卡（不受后台侧边栏影响）；
 * 2. 失败保留已填内容，`code 2003` 的 message（「账号或密码错误」）原样提示；
 * 3. 支持 `?redirect=` 回跳（仅接受 /admin 开头的站内后台地址，缺省 ADMINS_DEFAULT_REDIRECT）；
 * 4. 已登录访问本页 → 直接跳目标页；
 * 5. 演示账号只提示「见 README」，**页面不出现任何密码**。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Input from '../../components/ui/Input.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ERROR_CODES } from '../../lib/api.js';
import { ADMIN_DEFAULT_REDIRECT, ROUTES } from '../../lib/constants.js';
import { RULES, mergeServerErrors, validateForm } from '../../lib/validate.js';

/** 表单初值 */
const EMPTY_VALUES = Object.freeze({ username: '', password: '' });

/**
 * 解析回跳地址：只允许后台站内路径，其余回落到 /admin。
 * @param {string} raw
 * @returns {string}
 */
function resolveRedirect(raw) {
  const target = String(raw || '').trim();
  if (!target) return ADMIN_DEFAULT_REDIRECT;
  if (!target.startsWith('/admin')) return ADMIN_DEFAULT_REDIRECT;
  if (target.startsWith(ROUTES.ADMIN_LOGIN)) return ADMIN_DEFAULT_REDIRECT;
  return target;
}

/**
 * 管理员登录页。
 * @returns {JSX.Element}
 */
export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { admin, loading, login } = useAdminAuth();
  const { showToast } = useToast();

  const [values, setValues] = useState({ ...EMPTY_VALUES });
  const [errors, setErrors] = useState({});
  const [formAlert, setFormAlert] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const target = useMemo(() => resolveRedirect(searchParams.get('redirect')), [searchParams]);
  const passwordChanged = searchParams.get('reason') === 'password-changed';

  // 已登录（含刷新后 token 校验通过）直接回后台，避免重复登录
  useEffect(() => {
    if (loading || !admin) return;
    navigate(target, { replace: true });
  }, [admin, loading, navigate, target]);

  /**
   * 字段变更（清掉该字段旧错误）。
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
    username: [RULES.required('管理员账号'), RULES.maxLen(20, '管理员账号')],
    password: [RULES.required('密码')],
  };

  /**
   * 提交登录。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const result = validateForm(values, schema);
    if (!result.valid) {
      setErrors(result.errors);
      setFormAlert('');
      return;
    }

    setErrors({});
    setFormAlert('');
    setSubmitting(true);

    try {
      await login(values.username.trim(), values.password);
      setSubmitting(false);
      showToast('登录成功', 'success');
      navigate(target, { replace: true });
    } catch (error) {
      setSubmitting(false);
      const message = (error && error.message) || '登录失败，请稍后重试';
      if (error && error.fieldErrors) {
        setErrors(mergeServerErrors({}, error));
        setFormAlert(message);
        return;
      }
      if (error && (error.code === ERROR_CODES.BAD_CREDENTIALS || error.code === ERROR_CODES.UNAUTHORIZED)) {
        // 账号或密码错误：保留输入，只做提示
        setFormAlert(message);
        return;
      }
      setFormAlert(message);
    }
  };

  // token 校验中：先给全屏占位，避免「先闪登录表单再跳走」
  if (loading) return <Spinner fullPage label="正在确认管理员身份" />;

  return (
    <div className="a-login">
      <div className="a-login__card">
        <div className="a-login__brand">
          <span className="a-login__mark">e</span>
          <span className="a-login__name">e起去旅行 · 管理后台</span>
        </div>

        <h1 className="a-login__title">管理员登录</h1>
        <p className="a-login__desc">登录后可管理地区、景区、游记、会员与意见建议。</p>

        {passwordChanged ? (
          <p className="a-login__notice" role="status">
            密码已修改，请使用新密码重新登录。
          </p>
        ) : null}

        {formAlert ? (
          <p className="a-login__error" role="alert">
            {formAlert}
          </p>
        ) : null}

        <form className="a-login__form" onSubmit={handleSubmit} noValidate>
          <FormField label="管理员账号" required error={errors.username} htmlFor="admin-username">
            <Input
              id="admin-username"
              name="username"
              value={values.username}
              onChange={(event) => handleChange('username', event.target.value)}
              placeholder="请输入管理员账号"
              autoComplete="username"
              autoFocus
            />
          </FormField>

          <FormField label="密码" required error={errors.password} htmlFor="admin-password">
            <Input
              id="admin-password"
              name="password"
              type="password"
              value={values.password}
              onChange={(event) => handleChange('password', event.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </FormField>

          <Button type="submit" block loading={submitting}>
            登录后台
          </Button>
        </form>

        <p className="a-login__hint">演示账号见 README.md「默认账号」表格，本站不在页面展示密码。</p>
        <p className="a-login__foot">
          <Link to={ROUTES.HOME}>返回前台首页</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
