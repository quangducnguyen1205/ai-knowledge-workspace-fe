import { isApiClientError } from './api-error';

export type UserSafeErrorCopy = {
  title: string;
  message: string;
};

const COPY_BY_CODE: Record<string, UserSafeErrorCopy> = {
  AUTHENTICATION_REQUIRED: {
    title: 'Cần đăng nhập',
    message: 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại để tiếp tục.',
  },
  INVALID_CREDENTIALS: {
    title: 'Email hoặc mật khẩu chưa đúng',
    message: 'Kiểm tra lại thông tin đăng nhập rồi thử lại.',
  },
  EMAIL_ALREADY_REGISTERED: {
    title: 'Email đã được đăng ký',
    message: 'Hãy đăng nhập bằng email này hoặc sử dụng một địa chỉ email khác.',
  },
  INVALID_EMAIL: {
    title: 'Email chưa hợp lệ',
    message: 'Nhập đầy đủ một địa chỉ email hợp lệ rồi thử lại.',
  },
  INVALID_PASSWORD: {
    title: 'Mật khẩu chưa hợp lệ',
    message: 'Kiểm tra yêu cầu về mật khẩu rồi thử lại.',
  },
  INVALID_AUTH_REQUEST: {
    title: 'Thông tin đăng nhập chưa đầy đủ',
    message: 'Kiểm tra các trường trong biểu mẫu rồi gửi lại.',
  },
  AUTH_MODE_UNAVAILABLE: {
    title: 'Chưa thể đăng nhập',
    message: 'Phương thức đăng nhập hiện tại tạm thời chưa sẵn sàng.',
  },
  INVALID_WORKSPACE_NAME: {
    title: 'Tên workspace chưa hợp lệ',
    message: 'Nhập tên workspace không để trống và nằm trong giới hạn cho phép.',
  },
  WORKSPACE_NOT_FOUND: {
    title: 'Không tìm thấy workspace',
    message: 'Workspace không còn tồn tại hoặc bạn không có quyền truy cập.',
  },
  DEFAULT_WORKSPACE_DELETE_FORBIDDEN: {
    title: 'Không thể xóa workspace mặc định',
    message: 'Workspace mặc định được bảo vệ và không thể xóa.',
  },
  WORKSPACE_NOT_EMPTY: {
    title: 'Workspace vẫn còn tài liệu',
    message: 'Hãy xóa các tài liệu trong workspace trước rồi thử lại.',
  },
  INVALID_UPLOAD_FILE: {
    title: 'Tệp tải lên không được hỗ trợ',
    message: 'Chọn tệp video MP4, MOV, M4V, WebM hoặc AVI hợp lệ.',
  },
  INVALID_ASSET_TITLE: {
    title: 'Tiêu đề chưa hợp lệ',
    message: 'Nhập tiêu đề không để trống và nằm trong giới hạn cho phép.',
  },
  ASSET_NOT_FOUND: {
    title: 'Không tìm thấy tài liệu',
    message: 'Tài liệu không còn tồn tại hoặc bạn không có quyền truy cập.',
  },
  PROCESSING_JOB_NOT_FOUND: {
    title: 'Không tìm thấy tiến trình xử lý',
    message: 'Tải lại trang để cập nhật trạng thái mới nhất của tài liệu.',
  },
  TRANSCRIPT_ROW_NOT_FOUND: {
    title: 'Không tìm thấy đoạn transcript',
    message: 'Đoạn transcript đã chọn không còn khả dụng.',
  },
  PROCESSING_SERVICE_UNAVAILABLE: {
    title: 'Xử lý video tạm thời chưa sẵn sàng',
    message: 'Tệp chưa được gửi đi xử lý. Vui lòng thử lại sau.',
  },
  FASTAPI_CONNECTIVITY_ERROR: {
    title: 'Xử lý video tạm thời chưa sẵn sàng',
    message: 'Tệp chưa được gửi đi xử lý. Vui lòng thử lại sau.',
  },
  FASTAPI_INTEGRATION_ERROR: {
    title: 'Xử lý video tạm thời chưa sẵn sàng',
    message: 'Tệp chưa được gửi đi xử lý. Vui lòng thử lại sau.',
  },
  SEARCH_SERVICE_UNAVAILABLE: {
    title: 'Tìm kiếm tạm thời chưa sẵn sàng',
    message: 'Chưa thể hoàn tất thao tác tìm kiếm. Vui lòng thử lại sau.',
  },
  ELASTICSEARCH_UNAVAILABLE: {
    title: 'Tìm kiếm tạm thời chưa sẵn sàng',
    message: 'Chưa thể hoàn tất thao tác tìm kiếm. Vui lòng thử lại sau.',
  },
  ELASTICSEARCH_INTEGRATION_ERROR: {
    title: 'Tìm kiếm tạm thời chưa sẵn sàng',
    message: 'Chưa thể hoàn tất thao tác tìm kiếm. Vui lòng thử lại sau.',
  },
  STORAGE_SERVICE_UNAVAILABLE: {
    title: 'Lưu trữ tạm thời chưa sẵn sàng',
    message: 'Tệp chưa được lưu. Vui lòng thử lại sau.',
  },
  OBJECT_STORAGE_ERROR: {
    title: 'Lưu trữ tạm thời chưa sẵn sàng',
    message: 'Tệp chưa được lưu. Vui lòng thử lại sau.',
  },
  ASSISTANT_SERVICE_UNAVAILABLE: {
    title: 'Trợ lý tạm thời chưa sẵn sàng',
    message: 'Chưa thể tạo câu trả lời. Bạn vẫn có thể đọc transcript và kết quả tìm kiếm.',
  },
  ASSISTANT_PROVIDER_UNAVAILABLE: {
    title: 'Trợ lý tạm thời chưa sẵn sàng',
    message: 'Chưa thể tạo câu trả lời. Bạn vẫn có thể đọc transcript và kết quả tìm kiếm.',
  },
};

export function getUserSafeErrorCopy(error: unknown): UserSafeErrorCopy {
  if (!isApiClientError(error)) {
    return {
      title: 'Đã xảy ra lỗi',
      message: 'Không thể hoàn tất thao tác. Vui lòng thử lại sau.',
    };
  }

  if (error.code && COPY_BY_CODE[error.code]) {
    return COPY_BY_CODE[error.code];
  }

  if (error.status === 0) {
    return {
      title: 'Không thể kết nối',
      message: 'Kiểm tra kết nối mạng rồi thử lại.',
    };
  }

  if (error.status === 400 || error.status === 413 || error.status === 415 || error.status === 422) {
    return {
      title: 'Yêu cầu chưa hợp lệ',
      message: 'Kiểm tra thông tin đã nhập rồi thử lại.',
    };
  }

  if (error.status === 401) {
    return COPY_BY_CODE.AUTHENTICATION_REQUIRED;
  }

  if (error.status === 403) {
    return {
      title: 'Không có quyền thực hiện',
      message: 'Bạn không có quyền thực hiện thao tác này.',
    };
  }

  if (error.status === 404) {
    return {
      title: 'Không tìm thấy nội dung',
      message: 'Nội dung không còn tồn tại hoặc bạn không có quyền truy cập.',
    };
  }

  if (error.status === 409) {
    return {
      title: 'Chưa thể hoàn tất thao tác',
      message: 'Trạng thái hiện tại chưa cho phép thao tác này. Hãy kiểm tra lại rồi thử lại.',
    };
  }

  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return {
      title: 'Dịch vụ tạm thời chưa sẵn sàng',
      message: 'Vui lòng thử lại sau.',
    };
  }

  return {
    title: 'Đã xảy ra lỗi',
    message: 'Không thể hoàn tất thao tác. Vui lòng thử lại sau.',
  };
}
