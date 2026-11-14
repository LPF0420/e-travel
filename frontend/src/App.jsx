/**
 * 应用根组件：路由出口 + 全局提示队列。
 *
 * Toast 只在这里挂一份（不放进 Layout），这样前台/后台切换时提示不会重复渲染，
 * 也不会因为布局卸载而丢失入场动画。
 */

import AppRoutes from './routes.jsx';
import Toast from './components/ui/Toast.jsx';
import { useToast } from './context/ToastContext.jsx';

/**
 * @returns {JSX.Element}
 */
export default function App() {
  const { toasts, dismissToast } = useToast();

  return (
    <>
      <AppRoutes />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
