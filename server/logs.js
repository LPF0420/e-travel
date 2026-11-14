/**
 * 日志内核：三类日志的写入（操作日志 / 管理员日志 / 会员登录日志）。
 *
 * 约定（DESIGN §7.6）：
 * - 追加到内存数组 → 超上限裁剪最旧 → await db.save()；
 * - 写日志失败只 console.error，绝不影响业务结果（调用方业务数据已落盘）。
 */

import { LOG_LIMIT, LOG_RESULTS } from './constants.js';
import { db } from './db.js';
import { nowIso } from './utils.js';

/**
 * 裁剪超限日志（保留最新 LOG_LIMIT 条）。
 * @param {object[]} list
 * @returns {void}
 */
function trimOverflow(list) {
  if (list.length > LOG_LIMIT) {
    list.splice(0, list.length - LOG_LIMIT);
  }
}

/**
 * 写操作日志（地区/景区/游记的增改删，含失败）。
 * @param {object} input
 * @param {number} input.adminId
 * @param {string} input.adminName 账号快照
 * @param {'region'|'scenic'|'travel'} input.module
 * @param {'create'|'update'|'delete'} input.action
 * @param {number|null} [input.targetId]
 * @param {string} [input.targetName]
 * @param {'success'|'fail'} [input.result='success']
 * @param {string} [input.message='']
 * @param {string} [input.ip='']
 * @returns {Promise<void>}
 */
export async function writeOperationLog(input) {
  try {
    const result = LOG_RESULTS.includes(input.result) ? input.result : 'success';
    const log = {
      id: db.nextId('operationLogs'),
      adminId: Number.isInteger(input.adminId) ? input.adminId : 0,
      adminName: input.adminName || '',
      module: input.module,
      action: input.action,
      targetId: Number.isInteger(input.targetId) ? input.targetId : null,
      targetName: typeof input.targetName === 'string' ? input.targetName : '',
      result,
      message: typeof input.message === 'string' ? input.message : '',
      ip: typeof input.ip === 'string' ? input.ip : '',
      createdAt: nowIso(),
    };
    db.data.operationLogs.push(log);
    trimOverflow(db.data.operationLogs);
    await db.save();
  } catch (error) {
    console.error('[logs] 操作日志写入失败：', error.message);
  }
}

/**
 * 写管理员日志（登录/登录失败/退出/改密）。
 * @param {object} input
 * @param {string} input.username 尝试操作的账号（失败也记录输入值）
 * @param {number|null} [input.adminId]
 * @param {'login'|'login_fail'|'logout'|'change_password'} input.event
 * @param {'success'|'fail'} [input.result='success']
 * @param {string} [input.message='']
 * @param {string} [input.ip='']
 * @returns {Promise<void>}
 */
export async function writeAdminLog(input) {
  try {
    const result = LOG_RESULTS.includes(input.result) ? input.result : 'success';
    const log = {
      id: db.nextId('adminLogs'),
      username: input.username || '',
      adminId: Number.isInteger(input.adminId) ? input.adminId : null,
      event: input.event,
      ip: typeof input.ip === 'string' ? input.ip : '',
      result,
      message: typeof input.message === 'string' ? input.message : '',
      createdAt: nowIso(),
    };
    db.data.adminLogs.push(log);
    trimOverflow(db.data.adminLogs);
    await db.save();
  } catch (error) {
    console.error('[logs] 管理员日志写入失败：', error.message);
  }
}

/**
 * 写会员登录日志（成功与失败都记录）。
 * @param {object} input
 * @param {string} input.username 尝试登录的会员名（失败也记录）
 * @param {number|null} [input.memberId]
 * @param {'success'|'fail'} input.result
 * @param {string} [input.message='']
 * @param {string} [input.ip='']
 * @returns {Promise<void>}
 */
export async function writeMemberLoginLog(input) {
  try {
    const result = LOG_RESULTS.includes(input.result) ? input.result : 'success';
    const log = {
      id: db.nextId('memberLoginLogs'),
      username: input.username || '',
      memberId: Number.isInteger(input.memberId) ? input.memberId : null,
      ip: typeof input.ip === 'string' ? input.ip : '',
      result,
      message: typeof input.message === 'string' ? input.message : '',
      createdAt: nowIso(),
    };
    db.data.memberLoginLogs.push(log);
    trimOverflow(db.data.memberLoginLogs);
    await db.save();
  } catch (error) {
    console.error('[logs] 会员登录日志写入失败：', error.message);
  }
}
