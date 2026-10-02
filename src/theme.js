// antd theme mapped from the :root tokens in assets/hvs/app.css.
export const theme = {
  token: {
    colorPrimary: '#1463ff',
    colorSuccess: '#16a34a',
    colorWarning: '#ff9800',
    colorError: '#ef4444',
    colorInfo: '#1463ff',
    colorText: '#111827',
    colorTextSecondary: '#6b7280',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#e5e7eb',
    colorBgLayout: '#f5f5f5',
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  },
  components: {
    // Compact calendar so every picker popup fits the 390px phone with its 16px gutters:
    // date panel 7×32 + 24 = 248px, date + time (HH, mm) 248 + 2×44 = 336px.
    DatePicker: {
      cellWidth: 32,
      cellHeight: 24,
      textHeight: 36,
      withoutTimeCellHeight: 56,
      timeColumnWidth: 44,
      timeColumnHeight: 200,
      timeCellHeight: 26
    },
    Table: {
      headerBg: '#f9fafb',
      headerColor: '#374151',
      rowHoverBg: '#f3f7ff',
      cellPaddingBlock: 10,
      cellPaddingBlockSM: 4
    }
  }
};
