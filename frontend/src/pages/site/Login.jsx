/**
 * P-06 登录（PRD §5.1 P-06）
 *
 * - 布局用 AuthLayout（左图右表单），本页是裸路由，由页面自己套 AuthLayout。
 * - 字段：会员名 + 密码（会员名不是邮箱，见 DEFAULT_ACCOUNT_HINT.LOGIN_HINT）。
 * - 成功后回跳 `?redirect=` 指定地址，无参数则首页；已登录访问直接离开本页。
 * - 失败：字段级错误回填字段下红字（mergeServerErrors），整体错误走顶部 .form-alert。
 * - 不硬编码密码：只提示「演示账号见 README」+ 会员名。
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../../components/site/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Input from '../../components/ui/Input.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DEFAULT_ACCOUNT_HINT, DEFAULT_REDIRECT, ROUTES } from '../../lib/constants.js';
import { mergeServerErrors, RULES, validateForm } from '../../lib/validate.js';

/** 校验规则：登录只做「非空」判断，格式交给后端（避免老账号被前端挡下） */
const SCHEMA = {
  username: [RULES.required('会员名')],
  password: [RULES.required('密码')],
};

/**
 * 只允许站内路径回跳，防止 ?redirect=//evil.com 这类跳转。
 * @param {string|null} raw
 * @returns {string}
 */
function safeRedirect(raw) {
  const text = String(raw || '').trim();
  if (!text || !text.startsWith('/') || text.startsWith('//')) return DEFAULT_REDIRECT;
  return text;
}

/**
 * 登录页。
 * @returns {JSX.Element}
 */
export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { member, loading: authLoading, login } = useMemberAuth();
  const { showToast } = useToast();

  const redirect = safeRedirect(searchParams.get('redirect'));
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 首屏校验 token 期间先不渲染表单，避免「先闪登录框再跳走」
  if (authLoading) return <Spinner fullPage label="正在确认登录状态" />;
  if (member) return <Navigate to={redirect} replace />;

  /**
   * 更新字段。
   * @param {string} field
   * @param {string} value
   */
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  /**
   * 提交登录。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const result = validateForm(form, SCHEMA);
    if (!result.valid) {
      setErrors(result.errors);
      setFormError('请先填写会员名与密码');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setErrors({});
    try {
      const nextMember = await login(form.username.trim(), form.password);
      const name = nextMember && nextMember.username ? nextMember.username : form.username.trim();
      showToast(`欢迎回来，${name}`, 'success');
      navigate(redirect, { replace: true });
    } catch (error) {
      const message = (error && error.message) || '登录失败，请稍后重试';
      setErrors(mergeServerErrors({}, error));
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="欢迎回来"
      subtitle="登录后可以收藏想去的景区，也能把自己的行程写成游记。"
      footer={
        <span>
          还没有账号？
          <Link className="p-auth-link" to={ROUTES.MEMBER_REGISTER}>
            立即注册
          </Link>
        </span>
      }
    >
      <form className="p-auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        ) : null}

        <FormField label="会员名" required htmlFor="login-username" error={errors.username}>
          <Input
            id="login-username"
            value={form.username}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="请输入会员名"
            autoComplete="username"
            maxLength={20}
            error={Boolean(errors.username)}
          />
        </FormField>

        <FormField label="密码" required htmlFor="login-password" error={errors.password}>
          <Input
            id="login-password"
            type="password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
            maxLength={20}
            error={Boolean(errors.password)}
          />
        </FormField>

        <Button type="submit" variant="primary" size="lg" block loading={submitting}>
          登录
        </Button>

        <p className="p-auth-hint">
          会员请用会员名登录（例如「{DEFAULT_ACCOUNT_HINT.MEMBER_USERNAME}」），不是邮箱。
          <br />
          演示账号见 README。
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;
