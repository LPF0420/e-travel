/**
 * 弹窗（DESIGN §6.2 `.modal`）
 *
 * props：open, title, children, footer, onClose, size='md'|'sm', closeOnOverlay=true
 * 另导出 ConfirmDialog（二次确认，删除确认按钮用 .btn--danger）。
 *
 * 行为：ESC 关闭；打开时锁 body 滚动（body.is-modal-open）；点击遮罩关闭。
 * 用法：
 *   <Modal open={open} title="编辑地区" onClose={() => setOpen(false)} footer={<Button onClick={save}>保存</Button>}>
 *     ...
 *   </Modal>
 *   <ConfirmDialog open={delOpen} title="删除该地区？" desc="删除后不可恢复。"
 *                  danger confirmText="确认删除" onConfirm={doDelete} onClose={() => setDelOpen(false)} />
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import Button from './Button.jsx';

/** 关闭图标 */
function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

/**
 * 弹窗。
 * @param {object} props
 * @returns {JSX.Element|null}
 */
export function Modal({
  open = false,
  title = '',
  children,
  footer = null,
  onClose,
  size = 'md',
  closeOnOverlay = true,
  plain = false,
  className = '',
}) {
  // ESC 关闭 + 锁 body 滚动
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && typeof onClose === 'function') {
        event.stopPropagation();
        onClose();
      }
    };

    document.body.classList.add('is-modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('is-modal-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const classes = ['modal', `modal--${size === 'sm' ? 'sm' : 'md'}`];
  if (plain) classes.push('modal--plain');
  if (className) classes.push(className);

  /**
   * 点击遮罩关闭（仅当事件源就是遮罩本身）。
   * @param {React.MouseEvent<HTMLDivElement>} event
   */
  const handleOverlayClick = (event) => {
    if (!closeOnOverlay) return;
    if (event.target !== event.currentTarget) return;
    if (typeof onClose === 'function') onClose();
  };

  return createPortal(
    <div className={classes.join(' ')} onClick={handleOverlayClick} role="presentation">
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={title || '弹窗'}>
        {plain ? (
          children
        ) : (
          <>
            <div className="modal__header">
              <h2 className="modal__title">{title}</h2>
              <button type="button" className="modal__close" onClick={onClose} aria-label="关闭">
                <CloseIcon />
              </button>
            </div>
            <div className="modal__body">{children}</div>
            {footer ? <div className="modal__footer">{footer}</div> : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * 二次确认对话框（删除/批量操作前）。
 * @param {object} props
 * @returns {JSX.Element|null}
 */
export function ConfirmDialog({
  open = false,
  title = '确认操作',
  desc = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  // 操作按钮走 Modal 自带的 footer 插槽（带 .modal__footer 的分隔与内边距），不写内联样式
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        {cancelText}
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal open={open} title={title} onClose={onClose} size="sm" footer={footer}>
      <div className="modal__text">{desc}</div>
    </Modal>
  );
}

export default Modal;
