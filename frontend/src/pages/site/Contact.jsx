/**
 * P-10 联系我们（PRD §5.1 P-10）
 *
 * 左侧联系信息四卡（邮箱 / 电话 / 地址 / 工作时间，内联 SVG 图标）
 * 右侧留言表单：昵称 + 联系方式 + 留言内容（POST /api/feedbacks）
 *
 * 注意字段名：后端只接受 { nickname, contact, content }（见 server/routes/feedbacks.js），
 * 昵称 2–20 字、联系方式 2–50 字、内容 5–300 字；不接受「主题」字段，故表单不设主题。
 *
 * 空态 / 错误态：
 * - 本地校验失败 → 字段下红字（FormField error）
 * - 服务端 1001 → fieldErrors 回填字段，message 走顶部 .form-alert
 * - 成功 → 表单整体替换为成功态 + 「再写一条」
 */

import { useState } from 'react';

import Button from '../../components/ui/Button.jsx';
import FormField from '../../components/ui/FormField.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { post } from '../../lib/api.js';
import { mergeServerErrors, RULES, validateForm } from '../../lib/validate.js';

/** 留言内容上限（与后端 5–300 对齐） */
const CONTENT_MAX = 300;

/** 表单初始值 */
const EMPTY_FORM = { nickname: '', contact: '', content: '' };

/** 校验规则（阈值与后端 server/routes/feedbacks.js 完全一致） */
const SCHEMA = {
  nickname: [RULES.required('昵称'), RULES.lengthBetween(2, 20, '昵称')],
  contact: [RULES.required('联系方式'), RULES.lengthBetween(2, 50, '联系方式')],
  content: [RULES.required('留言内容'), RULES.lengthBetween(5, CONTENT_MAX, '留言内容')],
};

/** 联系信息四项（图标名 → 内联 SVG 渲染） */
const CONTACT_ITEMS = [
  {
    key: 'email',
    label: '邮箱',
    value: 'hello@equlvxing.example',
    hint: '工作日 48 小时内回复',
    icon: 'mail',
  },
  {
    key: 'phone',
    label: '电话',
    value: '028-8888 6666',
    hint: '周一至周五 09:30–18:00',
    icon: 'phone',
  },
  {
    key: 'address',
    label: '地址',
    value: '四川省成都市青羊区少城路 12 号 3 楼',
    hint: '来访请提前一天预约',
    icon: 'pin',
  },
  {
    key: 'hours',
    label: '工作时间',
    value: '周一至周五 09:30–18:00',
    hint: '节假日按公告调整',
    icon: 'clock',
  },
];

/**
 * 联系信息图标。
 * @param {{ name: string }} props
 * @returns {JSX.Element}
 */
function ContactIcon({ name }) {
  if (name === 'phone') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h3l2 5-2.2 1.6a11 11 0 0 0 5.6 5.6L17 14l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 4z" />
      </svg>
    );
  }
  if (name === 'pin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.4" />
        <path d="M12 7.4v5l3.4 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
      <path d="M3.6 7 12 13l8.4-6" />
    </svg>
  );
}

/**
 * 联系我们。
 * @returns {JSX.Element}
 */
export function Contact() {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  /**
   * 更新单个字段并清掉该字段的旧错误。
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
   * 提交留言。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const result = validateForm(form, SCHEMA);
    if (!result.valid) {
      setErrors(result.errors);
      setFormError('还有几处内容需要确认，请检查标红的字段');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setErrors({});
    try {
      // 已登录会员提交时由后端自动写入 memberId（optionalMember），游客也可提交
      await post(
        '/feedbacks',
        {
          nickname: form.nickname.trim(),
          contact: form.contact.trim(),
          content: form.content.trim(),
        },
        { scope: 'member' },
      );
      setSent(true);
      showToast('我们已收到你的建议', 'success');
    } catch (error) {
      const message = (error && error.message) || '提交失败，请稍后重试';
      setErrors(mergeServerErrors({}, error));
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 回到空白表单再写一条。
   */
  const writeAnother = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError('');
    setSent(false);
  };

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <h1 className="page-head__title">联系我们</h1>
          <p className="page-head__sub">
            信息有误、想补充一条攻略，或者希望合作？写信给我们，或者直接在这里留言。
          </p>
        </header>

        <div className="p-contact-layout">
          <div className="p-contact-info">
            {CONTACT_ITEMS.map((item) => (
              <div className="p-contact-item" key={item.key}>
                <span className="p-contact-item__icon" aria-hidden="true">
                  <ContactIcon name={item.icon} />
                </span>
                <div className="p-contact-item__body">
                  <p className="p-contact-item__label">{item.label}</p>
                  <p className="p-contact-item__value">{item.value}</p>
                  {item.hint ? <p className="p-contact-item__hint">{item.hint}</p> : null}
                </div>
              </div>
            ))}
            <p className="p-contact-info__note">
              我们不做票务代理，也不接受付费收录；涉及具体订单的问题请直接联系景区或平台。
            </p>
          </div>

          <section className="aside-card p-contact-form" aria-label="意见建议留言">
            {sent ? (
              <div className="p-contact-success">
                <span className="p-contact-success__icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="19" />
                    <path d="M15 24.5l6 6 12-13" />
                  </svg>
                </span>
                <h2 className="p-contact-success__title">我们已收到你的建议</h2>
                <p className="p-contact-success__desc">
                  编辑会在两个工作日内看完。如果是信息更正，我们会先核对再更新页面。
                </p>
                <Button variant="ghost" onClick={writeAnother}>
                  再写一条
                </Button>
              </div>
            ) : (
              <form className="p-contact-form__form" onSubmit={handleSubmit} noValidate>
                <h2 className="p-contact-form__title">给我们留言</h2>
                <p className="p-contact-form__desc">
                  带 * 的为必填项。留下有效的联系方式，才能收到我们的回复。
                </p>

                {formError ? (
                  <p className="form-alert" role="alert">
                    {formError}
                  </p>
                ) : null}

                <FormField label="昵称" required htmlFor="contact-nickname" error={errors.nickname}>
                  <Input
                    id="contact-nickname"
                    value={form.nickname}
                    onChange={(event) => updateField('nickname', event.target.value)}
                    placeholder="怎么称呼你（2–20 字）"
                    maxLength={20}
                    error={Boolean(errors.nickname)}
                  />
                </FormField>

                <FormField
                  label="联系方式"
                  required
                  htmlFor="contact-contact"
                  error={errors.contact}
                  hint="手机号或邮箱，只用于回复这条留言"
                >
                  <Input
                    id="contact-contact"
                    value={form.contact}
                    onChange={(event) => updateField('contact', event.target.value)}
                    placeholder="手机号或邮箱"
                    maxLength={50}
                    error={Boolean(errors.contact)}
                  />
                </FormField>

                <FormField label="留言内容" required htmlFor="contact-content" error={errors.content}>
                  <Textarea
                    id="contact-content"
                    value={form.content}
                    onChange={(event) => updateField('content', event.target.value)}
                    rows={7}
                    maxLength={CONTENT_MAX}
                    placeholder={`请具体描述：哪个景区、哪一段信息、你希望改成什么。（5–${CONTENT_MAX} 字）`}
                    error={Boolean(errors.content)}
                  />
                </FormField>

                <div className="p-contact-form__actions">
                  <Button type="submit" variant="primary" loading={submitting} block>
                    提交留言
                  </Button>
                </div>

                <p className="p-contact-form__privacy">
                  我们只用你留下的联系方式回复这条留言，不会用于营销推送，也不会提供给第三方。
                </p>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Contact;
