/**
 * P-13 仪表盘（F-25）
 *
 * 路由：/admin（索引）与 /admin/dashboard
 * 接口：GET /api/admin/dashboard → { stats, recentLogs }
 *
 * `stats` 真实键名（已 Read server/routes/admin/dashboard.js 确认）：
 *   regionCount 地区数 / scenicCount 景区数 / travelCount 游记数 /
 *   memberCount 会员数 / pendingFeedbackCount 待处理建议 / todayMemberLoginCount 今日会员登录次数
 * 注意：后端**没有**「今日操作数」字段，第六张卡改用 todayMemberLoginCount（今日会员登录），
 * 文案已写明口径，避免误读。
 *
 * recentLogs 已在服务端取最近 8 条，RecentLogList 内部再 slice(0,8)。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import RecentLogList from '../../components/admin/RecentLogList.jsx';
import StatCard from '../../components/admin/StatCard.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { ADMIN_PATHS, LIMITS, ROUTES } from '../../lib/constants.js';
import { get } from '../../lib/api.js';

/**
 * 仪表盘页。
 * @returns {JSX.Element}
 */
export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * 拉取概览数据。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(ADMIN_PATHS.DASHBOARD, { scope: 'admin' });
      setStats(data && data.stats ? data.stats : {});
      setRecentLogs(data && Array.isArray(data.recentLogs) ? data.recentLogs : []);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setStats(null);
      setRecentLogs([]);
      setError((err && err.message) || '概览数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = (key) => {
    const num = stats ? Number(stats[key]) : 0;
    return Number.isFinite(num) ? num : 0;
  };

  return (
    <div className="a-dash">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">仪表盘</h1>
          <p className="admin-head__desc">站点内容与运营数据总览，数据实时取自后台接口。</p>
        </div>
        <div className="a-row-actions">
          <Button variant="ghost" size="sm" onClick={load} loading={loading}>
            刷新数据
          </Button>
          <Link className="btn btn--primary btn--sm" to={ROUTES.ADMIN_HOME}>
            <span className="btn__label">概览</span>
          </Link>
        </div>
      </div>

      {error ? (
        <p className="form-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="a-dash__stats">
        <StatCard label="会员总数" value={value('memberCount')} icon="members" to="/admin/members" hint="全部注册会员" />
        <StatCard label="地区总数" value={value('regionCount')} icon="regions" to="/admin/regions" hint="含未推荐地区" />
        <StatCard label="景区总数" value={value('scenicCount')} icon="scenics" to="/admin/scenics" hint="含未推荐景区" />
        <StatCard label="游记总数" value={value('travelCount')} icon="travels" to="/admin/travels" hint="含会员投稿" />
        <StatCard
          label="待处理建议"
          value={value('pendingFeedbackCount')}
          icon="feedbacks"
          to="/admin/feedbacks"
          tone="accent"
          hint="点击进入意见建议处理"
        />
        <StatCard
          label="今日会员登录"
          value={value('todayMemberLoginCount')}
          icon="logs"
          to="/admin/logs?tab=memberLogin"
          tone="sky"
          hint="今日登录成功次数"
        />
      </div>

      <div className="a-dash__cols">
        <section className="admin-card">
          <div className="admin-card__head">
            <h2 className="admin-card__title">最近操作日志</h2>
            <Link className="a-dash__more" to="/admin/logs">
              查看全部日志
            </Link>
          </div>
          {loading && !recentLogs.length ? <Spinner label="正在加载操作日志" /> : <RecentLogList logs={recentLogs} />}
        </section>

        <section className="admin-card">
          <div className="admin-card__head">
            <h2 className="admin-card__title">快捷操作</h2>
            <span className="a-dash__hint">常用内容维护入口</span>
          </div>
          <div className="a-dash__quick">
            <Link className="a-dash__quick-item" to="/admin/regions/new">
              <span className="a-dash__quick-title">新增地区</span>
              <span className="a-dash__quick-desc">补充首页地区卡片</span>
            </Link>
            <Link className="a-dash__quick-item" to="/admin/scenics/new">
              <span className="a-dash__quick-title">新增景区</span>
              <span className="a-dash__quick-desc">完善景区详情与图集</span>
            </Link>
            <Link className="a-dash__quick-item" to="/admin/travels/new">
              <span className="a-dash__quick-title">新增游记</span>
              <span className="a-dash__quick-desc">代发运营精选游记</span>
            </Link>
            <Link className="a-dash__quick-item" to="/admin/feedbacks">
              <span className="a-dash__quick-title">查看意见反馈</span>
              <span className="a-dash__quick-desc">处理游客与会员留言</span>
            </Link>
          </div>
          <p className="a-dash__note">日志最多展示最近 {LIMITS.ADMIN_RECENT_LOGS} 条，完整记录请前往日志管理。</p>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
