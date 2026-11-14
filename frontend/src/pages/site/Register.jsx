/**
 * P-07 注册（PRD §5.1 P-07）
 *
 * 5 个字段：会员名 / 密码 / 确认密码 / 手机号 / 邮箱。
 * - 前端逐字段校验（validateForm + RULES，阈值与后端 server/utils.js 一致）
 * - 服务端 1001 的 fieldErrors 回填到对应字段下（如「该会员名已被注册」）
 * - 注册成功即自动登录并跳首页；若后端没有回 token，则用同一份凭据再调一次 login
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import AuthLayout from '../../components/site/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Input from '../../components/ui/Input.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ROUTES } from '../../lib/constants.js';
import { mergeServerErrors, RULES, validateForm } from '../../lib/validate.js';

/** 注册校验规则（与后端 /api/auth/register 完全对齐） */
const SCHEMA = {
  username: [RULES.required('会员名'), RULES.username('会员名')],
  password: [RULES.required('密码'), RULES.password('密码')],
  confirmPassword: [RULES.confirmPassword('password', '确认密码')],
  phone: [RULES.required('手机号'), RULES.phone('手机号')],
  email: [RULES.required('邮箱'), RULES.email('邮箱')],
};

/** 表单初始值 */
const EMPTY_FORM = { username: '', password: '', confirmPassword: '', phone: '', email: '' };

/**
 * 注册页。
 * @returns {JSX.Element}
 */
export function Register() {
  const navigate = useNavigate();
  const { member, loading: authLoading, register, login } = useMemberAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return <Spinner fullPage label="正在确认登录状态" />;
  if (member) return <Navigate to={ROUTES.HOME} replace />;

  /**
   * 更新字段（同时清掉该字段旧错误）。
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
   * 提交注册。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const result = validateForm(form, SCHEMA);
    if (!result.valid) {
      setErrors(result.errors);
      setFormError('还有几处内容不符合要求，请检查标红的字段');
      return;
    }

    const payload = {
      username: form.username.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
      phone: form.phone.trim(),
      email: form.email.trim(),
    };

    setSubmitting(true);
    setFormError('');
    setErrors({});
    try {
      const created = await register(payload);
      // 后端未返回会员对象（只回了 token 以外的东西）时，用同一份凭据补一次登录
      if (!created) await login(payload.username, payload.password);
      showToast('注册成功，已为你自动登录', 'success');
      navigate(ROUTES.HOME, { replace: true });
    } catch (error) {
      const message = (error && error.message) || '注册失败，请稍后重试';
      setErrors(mergeServerErrors({}, error));
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="创建账号"
      subtitle="只要一个会员名和联系方式，就能收藏景区、写下游记。"
      footer={
        <span>
          已有账号？
          <Link className="p-auth-link" to={ROUTES.MEMBER_LOGIN}>
            去登录
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

        <FormField
          label="会员名"
          required
          htmlFor="register-username"
          error={errors.username}
          hint="2–20 字，可用中文、字母、数字或下划线；登录时用它"
        >
          <Input
            id="register-username"
            value={form.username}
            onChange={(event) => updateField('username', event.target.value)}
            placeholder="取一个 2–20 字的会员名"
            autoComplete="username"
            maxLength={20}
            error={Boolean(errors.username)}
          />
        </FormField>

        <FormField
          label="密码"
          required
          htmlFor="register-password"
          error={errors.password}
          hint="6–20 位，建议字母加数字"
        >
          <Input
            id="register-password"
            type="password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder="设置登录密码"
            autoComplete="new-password"
            maxLength={20}
            error={Boolean(errors.password)}
          />
        </FormField>

        <FormField label="确认密码" required htmlFor="register-confirm" error={errors.confirmPassword}>
          <Input
            id="register-confirm"
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            placeholder="再输入一次密码"
            autoComplete="new-password"
            maxLength={20}
            error={Boolean(errors.confirmPassword)}
          />
        </FormField>

        <FormField label="手机号" required htmlFor="register-phone" error={errors.phone}>
          <Input
            id="register-phone"
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="11 位手机号，例如 13800138000"
            autoComplete="tel"
            maxLength={11}
            error={Boolean(errors.phone)}
          />
        </FormField>

        <FormField label="邮箱" required htmlFor="register-email" error={errors.email}>
          <Input
            id="register-email"
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            maxLength={60}
            error={Boolean(errors.email)}
          />
        </FormField>

        <Button type="submit" variant="primary" size="lg" block loading={submitting}>
          注册并登录
        </Button>

        <p className="p-auth-hint">
          注册即表示同意：我们仅用手机号与邮箱做账号识别与必要的服务通知，不会用于营销推送。
        </p>
      </form>
    </AuthLayout>
  );
}

export default Register;
