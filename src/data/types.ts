/** 单条异常车辆记录（从每日 CSV 解析而来） */
export interface AbnormalVehicle {
  /** 数据来源日期，如 2026-08-20 */
  date: string
  /** 车牌号 */
  plate: string
  /** 入场时间 HH:mm:ss，缺失为 null */
  entryTime: string | null
  /** 出场时间 HH:mm:ss，缺失为 null */
  exitTime: string | null
  /** 用户需支付费用（元） */
  fee: number
  /** 是否异常（CSV 异常列 1/0） */
  abnormal: boolean
}

/** 审批清单里一条记录的处理状态 */
export type ApprovalStatus = 'pending' | 'blacklisted' | 'removed'