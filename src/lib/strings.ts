export const T = {
  appTitle: 'VKU MES',
  login: {
    title: 'Đăng nhập',
    passwordLabel: 'Mật khẩu',
    submit: 'Đăng nhập',
    badCredentials: 'Mật khẩu không đúng'
  },
  dashboard: {
    running: 'Đang chạy',
    stopped: 'Đang dừng',
    shiftQty: 'Tổng sản lượng CA',
    headers: {
      stt: 'STT',
      name: 'Tên máy',
      status: 'Trạng thái',
      shiftQty: 'Sản lượng CA',
      runtime: 'Thời gian hoạt động',
      performance: 'Hiệu suất'
    },
    manualEntry: {
      title: (name: string) => `Nhập sản lượng — ${name}`,
      qty: 'Số lượng',
      defectQty: 'Phế phẩm',
      reason: 'Lý do (tuỳ chọn)',
      submit: 'Lưu',
      cancel: 'Huỷ',
      success: 'Đã lưu'
    }
  },
  supervisor: {
    title: 'Giám sát sản xuất',
    cards: { shiftQty: 'Tổng sản lượng CA', avgOee: 'OEE trung bình', runningStopped: 'Đang chạy / Dừng', openAlerts: 'Cảnh báo chưa xử lý' },
    hourlyChart: 'Sản lượng theo giờ',
    downtimeLog: 'Lịch sử dừng máy',
    alertsFeed: 'Cảnh báo',
    ack: 'Xác nhận'
  },
  admin: {
    title: 'Quản lý máy',
    columns: { code: 'Mã', name: 'Tên', target: 'Mục tiêu/giờ', alertThreshold: 'Ngưỡng im lặng (phút)', lowOutputPct: 'Ngưỡng SL thấp (%)' },
    create: 'Thêm máy',
    save: 'Lưu',
    edit: 'Sửa'
  },
  common: {
    logout: 'Đăng xuất',
    loading: 'Đang tải...',
    error: 'Đã xảy ra lỗi',
    yes: 'Có',
    no: 'Không'
  }
};
