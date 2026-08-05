/**
 * `errors` — the frontend-owned catalogue behind `shared/api/user-error-copy`.
 *
 * The policy this encodes: a backend error is never rendered as product copy. Spring's `code` and
 * HTTP status select a key here; the raw message, stack or diagnostic never reaches the screen.
 * A code with no entry falls through to `generic`, so an unmapped backend code degrades to a
 * localized sentence rather than leaking English internals into a Vietnamese UI.
 *
 * Feature-specific friendly copy (a failed rename, an unsupported upload) belongs to that
 * feature's namespace; only the cross-cutting catalogue lives here.
 */

const en = {
  generic: {
    title: 'Something went wrong',
    message: 'The action could not be completed. Try again later.',
  },
  connection: {
    title: 'Could not connect',
    message: 'Check your connection and try again.',
  },
  validation: {
    title: 'Check your information',
    message: 'Review what you entered and try again.',
  },
  forbidden: {
    title: 'Action not allowed',
    message: 'You do not have access to complete this action.',
  },
  notFound: {
    title: 'Content not found',
    message: 'It no longer exists or you do not have access.',
  },
  conflict: {
    title: 'Action not available',
    message: 'The current state does not allow this action. Check again and retry.',
  },
  serviceUnavailable: {
    title: 'Service temporarily unavailable',
    message: 'Try again later.',
  },
  codes: {
    AUTHENTICATION_REQUIRED: {
      title: 'Sign in required',
      message: 'Your session is no longer valid. Sign in again to continue.',
    },
    INVALID_CREDENTIALS: {
      title: 'Email or password is incorrect',
      message: 'Check your details and try again.',
    },
    EMAIL_ALREADY_REGISTERED: {
      title: 'Email already registered',
      message: 'Sign in with this email or use a different address.',
    },
    INVALID_EMAIL: {
      title: 'Enter a valid email',
      message: 'Use a complete email address and try again.',
    },
    INVALID_PASSWORD: {
      title: 'Password is not valid',
      message: 'Check the password requirements and try again.',
    },
    INVALID_AUTH_REQUEST: {
      title: 'Complete the form',
      message: 'Check the fields and submit again.',
    },
    AUTH_MODE_UNAVAILABLE: {
      title: 'Sign in is unavailable',
      message: 'The current sign-in method is temporarily unavailable.',
    },
    INVALID_WORKSPACE_NAME: {
      title: 'Workspace name is not valid',
      message: 'Enter a non-empty name within the allowed length.',
    },
    WORKSPACE_NOT_FOUND: {
      title: 'Workspace not found',
      message: 'It no longer exists or you do not have access.',
    },
    DEFAULT_WORKSPACE_DELETE_FORBIDDEN: {
      title: 'Default workspace cannot be deleted',
      message: 'The default workspace is protected.',
    },
    WORKSPACE_NOT_EMPTY: {
      title: 'Workspace still contains videos',
      message: 'Delete its videos before trying again.',
    },
    INVALID_UPLOAD_FILE: {
      title: 'Video format is not supported',
      message: 'Choose an MP4, MOV, M4V, WebM, or AVI video.',
    },
    INVALID_ASSET_TITLE: {
      title: 'Video title is not valid',
      message: 'Enter a non-empty title within the allowed length.',
    },
    ASSET_NOT_FOUND: {
      title: 'Video not found',
      message: 'It no longer exists or you do not have access.',
    },
    PROCESSING_JOB_NOT_FOUND: {
      title: 'Video status is unavailable',
      message: 'Reload the page to get the latest status.',
    },
    TRANSCRIPT_ROW_NOT_FOUND: {
      title: 'Transcript moment not found',
      message: 'The selected moment is no longer available.',
    },
    PROCESSING_SERVICE_UNAVAILABLE: {
      title: 'Video processing is unavailable',
      message: 'The video was not sent for processing. Try again later.',
    },
    SEARCH_SERVICE_UNAVAILABLE: {
      title: 'Search is temporarily unavailable',
      message: 'Try your search again later.',
    },
    STORAGE_SERVICE_UNAVAILABLE: {
      title: 'Upload is temporarily unavailable',
      message: 'The video was not saved. Try again later.',
    },
    ASSISTANT_SERVICE_UNAVAILABLE: {
      title: 'Answers are temporarily unavailable',
      message: 'You can still read and search the transcript.',
    },
  },
};

const vi: typeof en = {
  generic: {
    title: 'Đã xảy ra lỗi',
    message: 'Không thể hoàn tất thao tác. Vui lòng thử lại sau.',
  },
  connection: {
    title: 'Không kết nối được',
    message: 'Kiểm tra kết nối mạng và thử lại.',
  },
  validation: {
    title: 'Kiểm tra lại thông tin',
    message: 'Xem lại nội dung bạn đã nhập và thử lại.',
  },
  forbidden: {
    title: 'Không được phép thực hiện',
    message: 'Bạn không có quyền thực hiện thao tác này.',
  },
  notFound: {
    title: 'Không tìm thấy nội dung',
    message: 'Nội dung không còn tồn tại hoặc bạn không có quyền truy cập.',
  },
  conflict: {
    title: 'Thao tác không khả dụng',
    message: 'Trạng thái hiện tại không cho phép thao tác này. Kiểm tra lại rồi thử tiếp.',
  },
  serviceUnavailable: {
    title: 'Dịch vụ tạm thời không khả dụng',
    message: 'Vui lòng thử lại sau.',
  },
  codes: {
    AUTHENTICATION_REQUIRED: {
      title: 'Cần đăng nhập',
      message: 'Phiên làm việc không còn hiệu lực. Đăng nhập lại để tiếp tục.',
    },
    INVALID_CREDENTIALS: {
      title: 'Email hoặc mật khẩu không đúng',
      message: 'Kiểm tra lại thông tin và thử lại.',
    },
    EMAIL_ALREADY_REGISTERED: {
      title: 'Email đã được đăng ký',
      message: 'Đăng nhập bằng email này hoặc dùng một địa chỉ khác.',
    },
    INVALID_EMAIL: {
      title: 'Nhập email hợp lệ',
      message: 'Dùng một địa chỉ email đầy đủ và thử lại.',
    },
    INVALID_PASSWORD: {
      title: 'Mật khẩu không hợp lệ',
      message: 'Kiểm tra yêu cầu về mật khẩu và thử lại.',
    },
    INVALID_AUTH_REQUEST: {
      title: 'Điền đầy đủ biểu mẫu',
      message: 'Kiểm tra các trường thông tin và gửi lại.',
    },
    AUTH_MODE_UNAVAILABLE: {
      title: 'Không thể đăng nhập',
      message: 'Phương thức đăng nhập hiện tại tạm thời không khả dụng.',
    },
    INVALID_WORKSPACE_NAME: {
      title: 'Tên không gian làm việc không hợp lệ',
      message: 'Nhập tên không để trống và trong độ dài cho phép.',
    },
    WORKSPACE_NOT_FOUND: {
      title: 'Không tìm thấy không gian làm việc',
      message: 'Không gian này không còn tồn tại hoặc bạn không có quyền truy cập.',
    },
    DEFAULT_WORKSPACE_DELETE_FORBIDDEN: {
      title: 'Không thể xóa không gian mặc định',
      message: 'Không gian làm việc mặc định được bảo vệ.',
    },
    WORKSPACE_NOT_EMPTY: {
      title: 'Không gian làm việc vẫn còn video',
      message: 'Xóa hết video trong không gian này rồi thử lại.',
    },
    INVALID_UPLOAD_FILE: {
      title: 'Định dạng video không được hỗ trợ',
      message: 'Chọn video định dạng MP4, MOV, M4V, WebM hoặc AVI.',
    },
    INVALID_ASSET_TITLE: {
      title: 'Tiêu đề video không hợp lệ',
      message: 'Nhập tiêu đề không để trống và trong độ dài cho phép.',
    },
    ASSET_NOT_FOUND: {
      title: 'Không tìm thấy video',
      message: 'Video không còn tồn tại hoặc bạn không có quyền truy cập.',
    },
    PROCESSING_JOB_NOT_FOUND: {
      title: 'Không lấy được trạng thái video',
      message: 'Tải lại trang để xem trạng thái mới nhất.',
    },
    TRANSCRIPT_ROW_NOT_FOUND: {
      title: 'Không tìm thấy khoảnh khắc',
      message: 'Khoảnh khắc đã chọn không còn khả dụng.',
    },
    PROCESSING_SERVICE_UNAVAILABLE: {
      title: 'Dịch vụ xử lý video không khả dụng',
      message: 'Video chưa được gửi đi xử lý. Vui lòng thử lại sau.',
    },
    SEARCH_SERVICE_UNAVAILABLE: {
      title: 'Tìm kiếm tạm thời không khả dụng',
      message: 'Vui lòng tìm lại sau.',
    },
    STORAGE_SERVICE_UNAVAILABLE: {
      title: 'Tải lên tạm thời không khả dụng',
      message: 'Video chưa được lưu. Vui lòng thử lại sau.',
    },
    ASSISTANT_SERVICE_UNAVAILABLE: {
      title: 'Tính năng trả lời tạm thời không khả dụng',
      message: 'Bạn vẫn có thể đọc và tìm kiếm trong bản chép lời.',
    },
  },
};

export const errors = { en, vi };
