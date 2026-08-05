/**
 * `common` — copy that genuinely belongs to no single feature: the reversible actions every
 * screen offers, and the few product words that must read identically wherever they appear.
 *
 * Anything a feature owns stays in that feature's namespace. A string lands here only because at
 * least two features render it.
 */

const en = {
  actions: {
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting...',
    rename: 'Rename',
    open: 'Open',
    clear: 'Clear',
    dismiss: 'Dismiss',
    dismissNotice: 'Dismiss {{title}}',
  },
  skipToContent: 'Skip to content',
  /** `formatDateTime` fallback when a record carries no usable timestamp. */
  unknownDateTime: 'Unknown',
  /** A transcript row the backend gave no usable timing for. */
  timeUnavailable: 'Time unavailable',
  videoMoment: 'Video moment',
  /** Transcript rows are addressed by their canonical segment index, never by position. */
  momentIndex: 'Moment {{index}}',
  videoCount_one: '{{count}} video',
  videoCount_other: '{{count}} videos',
};

/**
 * Vietnamese does not inflect for number, so both plural forms carry the same text. The key set
 * still mirrors English exactly — see `resources/index.ts` for why that invariant is enforced.
 */
const vi: typeof en = {
  actions: {
    save: 'Lưu',
    saving: 'Đang lưu...',
    cancel: 'Hủy',
    delete: 'Xóa',
    deleting: 'Đang xóa...',
    rename: 'Đổi tên',
    open: 'Mở',
    clear: 'Xóa lựa chọn',
    dismiss: 'Đóng',
    dismissNotice: 'Đóng thông báo {{title}}',
  },
  skipToContent: 'Bỏ qua, tới nội dung chính',
  unknownDateTime: 'Không rõ',
  timeUnavailable: 'Không có mốc thời gian',
  videoMoment: 'Khoảnh khắc trong video',
  momentIndex: 'Đoạn {{index}}',
  videoCount_one: '{{count}} video',
  videoCount_other: '{{count}} video',
};

export const common = { en, vi };
