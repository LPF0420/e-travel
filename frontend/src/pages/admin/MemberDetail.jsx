/**
 * P-15 会员详情（F-27）
 *
 * 路由：/admin/members/:id
 * 接口：GET /api/admin/members/:id
 *       → { member, favorites:[景区精简+收藏时间], loginLogs:[最近 10 条登录记录] }
 *
 * 后端详情已一次性返回收藏景区与最近登录记录，**不再额外调 /logs/member-logins**。
 * 收藏景区标签可点击，新窗口打开前台景区详情 /scenic/:id。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Tag from '../../components/ui/Tag.jsx';
import { ADMIN_PATHS, LOG_RESULT_LABELS, ROUTES } from '../../lib/constants.js';
import { get } from '../../lib/api.js';
import { formatDateTime, initialOf } from '../../lib/format.js';

/**
 * 会员详情页。
 * @returns {JSX.Element}
 */
export function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * 拉取会员详情。
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await get(`${ADMIN_PATHS.MEMBERS}/${id}`, { scope: 'admin' });
      setMember(data && data.member ? data.member : null);
      setFavorites(data && Array.isArray(data.favorites) ? data.favorites : []);
      setLoginLogs(data && Array.isArray(data.loginLogs) ? data.loginLogs : []);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) return;
      setMember(null);
      setFavorites([]);
      setLoginLogs([]);
      setError((err && err.message) || '会员详情加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loginColumns = [
    { key: 'createdAt', title: '登录时间', width: '180px', render: (row) => formatDateTime(row.createdAt) || '—' },
    { key: 'username', title: '会员名', width: '160px', render: (row) => row.username || '—' },
    {
      key: 'result',
      title: '结果',
      width: '100px',
      render: (row) => (
        <Tag variant={row.result === 'success' ? 'resolved' : 'pending'} size="sm">
          {LOG_RESULT_LABELS[row.result] || row.result || '—'}
        </Tag>
      ),
    },
    { key: 'message', title: '说明', render: (row) => row.message || '—' },
    { key: 'ip', title: 'IP', width: '140px', render: (row) => row.ip || '—' },
  ];

  const lastLoginAt = loginLogs.length ? loginLogs[0].createdAt : '';

  if (loading) return <Spinner fullPage label="正在加载会员资料" />;

  if (error || !member) {
    return (
      <div className="a-member-detail">
        <div className="admin-head">
          <div>
            <h1 className="admin-head__title">会员详情</h1>
            <p className="admin-head__desc">查看会员资料、收藏的景区与最近登录记录。</p>
          </div>
        </div>
        <EmptyState
          art="search"
          title="没有找到该会员"
          desc={error || '该会员可能已被删除，请返回列表重新选择'}
          actionText="返回会员列表"
          onAction={() => navigate('/admin/members')}
        />
      </div>
    );
  }

  return (
    <div className="a-member-detail">
      <div className="admin-head">
        <div>
          <h1 className="admin-head__title">会员详情</h1>
          <p className="admin-head__desc">会员 ID #{member.id}，资料由会员注册时填写，后台不可修改。</p>
        </div>
        <div className="a-row-actions">
          <Button variant="ghost" size="sm" onClick={load} loading={loading}>
            刷新
          </Button>
          <Button size="sm" onClick={() => navigate('/admin/members')}>
            返回列表
          </Button>
        </div>
      </div>

      <section className="admin-card a-member__profile">
        <span className="avatar a-member__avatar">{initialOf(member.username)}</span>
        <div className="a-member__body">
          <h2 className="a-member__username">{member.username || '—'}</h2>
          <dl className="a-member__meta">
            <div className="a-member__meta-item">
              <dt>手机号</dt>
              <dd>{member.phone || '—'}</dd>
            </div>
            <div className="a-member__meta-item">
              <dt>邮箱</dt>
              <dd>{member.email || '—'}</dd>
            </div>
            <div className="a-member__meta-item">
              <dt>注册时间</dt>
              <dd>{formatDateTime(member.createdAt) || '—'}</dd>
            </div>
            <div className="a-member__meta-item">
              <dt>最后登录</dt>
              <dd>{lastLoginAt ? formatDateTime(lastLoginAt) : '暂无登录记录'}</dd>
            </div>
            <div className="a-member__meta-item">
              <dt>收藏景区</dt>
              <dd>{Number.isFinite(Number(member.favoriteCount)) ? member.favoriteCount : favorites.length} 个</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">收藏的景区</h2>
          <span className="a-dash__hint">点击标签在新窗口打前台详情</span>
        </div>
        {favorites.length ? (
          <div className="a-member__favorites">
            {favorites.map((scenic) => (
              <Link
                key={scenic.id}
                className="a-member__fav-link"
                to={`/scenic/${scenic.id}`}
                target="_blank"
                rel="noreferrer"
                title={`收藏于 ${formatDateTime(scenic.favoritedAt) || '未知时间'}`}
              >
                <Tag variant="region">{scenic.name}</Tag>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState inline art="suitcase" title="该会员还没有收藏任何景区" />
        )}
      </section>

      <section className="admin-card admin-card--flush">
        <div className="admin-card__head a-member__logs-head">
          <h2 className="admin-card__title">最近登录记录</h2>
          <Link className="a-dash__more" to="/admin/logs?tab=memberLogin">
            查看全部会员登录日志
          </Link>
        </div>
        <DataTable
          columns={loginColumns}
          rows={loginLogs}
          loading={false}
          rowKey="id"
          emptyText="该会员还没有登录记录"
        />
      </section>

      <p className="a-member__foot">
        <Link className="btn btn--ghost btn--sm" to={ROUTES.ADMIN_HOME}>
          <span className="btn__label">返回管理后台</span>
        </Link>
      </p>
    </div>
  );
}

export default MemberDetail;
