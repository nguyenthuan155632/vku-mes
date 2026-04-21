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
    edit: 'Nhập sản lượng',
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
  shifts: {
    title: 'Quản lý ca làm việc',
    addShift: 'Thêm ca',
    active: 'Đang hoạt động',
    inactive: 'Tắt',
    enable: 'Bật',
    disable: 'Tắt',
    edit: 'Sửa',
    delete: 'Xoá',
    deleteConfirm: 'Xác nhận xoá ca này?',
    columns: { number: '#', name: 'Tên ca', start: 'Bắt đầu', end: 'Kết thúc', duration: 'Thời lượng', status: 'Trạng thái' },
    form: {
      createTitle: 'Thêm ca mới',
      editTitle: 'Sửa ca',
      name: 'Tên ca',
      shiftNumber: 'Số ca',
      startTime: 'Giờ bắt đầu',
      endTime: 'Giờ kết thúc',
      duration: 'Thời lượng',
      crossMidnight: '(qua nửa đêm)',
    }
  },
  output: {
    title: (name: string) => `Sản lượng — ${name}`,
    timeRange: 'Khoảng thời gian',
    hours: (n: number) => `${n} giờ`,
    chart: 'Biểu đồ sản lượng theo giờ',
    cards: {
      totalQty: 'Tổng sản lượng',
      defectQty: 'Phế phẩm',
      defectRate: 'Tỷ lệ phế'
    },
    table: {
      hour: 'Giờ',
      qty: 'Sản lượng',
      defectQty: 'Phế phẩm',
      defectRate: 'Tỷ lệ phế',
      noData: 'Không có dữ liệu trong khoảng thời gian này'
    },
    legend: {
      qty: 'Sản lượng',
      defect: 'Phế phẩm'
    }
  },
  common: {
    logout: 'Đăng xuất',
    loading: 'Đang tải...',
    error: 'Đã xảy ra lỗi',
    yes: 'Có',
    no: 'Không',
    backToDashboard: '← Về Dashboard'
  }
};
