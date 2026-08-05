/** `workspaces` — workspace creation, renaming and the delete confirmation dialog. */

const en = {
  current: 'Current workspace',
  empty: 'No workspace yet',
  nameLabel: 'Workspace name',
  create: {
    title: 'Create workspace',
    description: 'Use a short name that is easy to recognize in the header.',
    placeholder: 'Algorithms, Databases, Distributed Systems',
    submit: 'Create workspace',
    submitting: 'Creating...',
  },
  manage: {
    title: 'Rename or delete',
    description: 'Changes apply to the current workspace.',
    placeholder: 'Rename the active workspace',
    rename: 'Rename workspace',
    delete: 'Delete workspace',
  },
  deleteDialog: {
    eyebrow: 'Confirm workspace deletion',
    title: 'Delete “{{name}}”?',
    description:
      'Only empty, non-default workspaces can be deleted. This action cannot be undone after the service confirms it.',
  },
  notices: {
    created: {
      title: 'Workspace created',
      message: 'Created "{{name}}" and refreshed the visible workspace scope.',
    },
    renamed: {
      title: 'Workspace renamed',
      message: 'Active workspace is now "{{name}}".',
    },
    deleted: {
      title: 'Workspace deleted',
      messageActive: 'Removed "{{name}}" and refreshed the visible workspace scope.',
      messageOther: 'Removed "{{name}}" without changing the current workspace scope.',
    },
  },
  errors: {
    renameInvalidName: {
      title: 'Workspace name is not valid',
      message: 'Enter a non-empty name within the allowed length.',
    },
    renameNotFound: {
      title: 'Workspace not found',
      message: 'It no longer exists or you do not have access.',
    },
    renameOffline: {
      title: 'Could not rename workspace',
      message: 'Check your connection and try again. The previous name was kept.',
    },
    renameFailed: {
      title: 'Could not rename workspace',
      message: 'The previous name was kept. Try again later.',
    },
    deleteDefaultForbidden: {
      title: 'Default workspace cannot be deleted',
      message: 'The default workspace is protected.',
    },
    deleteNotEmpty: {
      title: 'Workspace still contains videos',
      message: 'Delete its videos before trying again.',
    },
    deleteNotFound: {
      title: 'Workspace not found',
      message: 'It no longer exists or you do not have access.',
    },
    deleteOffline: {
      title: 'Could not delete workspace',
      message: 'Check your connection and try again. The workspace was not deleted.',
    },
    deleteFailed: {
      title: 'Could not delete workspace',
      message: 'The workspace was not deleted. Try again later.',
    },
  },
};

const vi: typeof en = {
  current: 'Không gian làm việc hiện tại',
  empty: 'Chưa có không gian làm việc',
  nameLabel: 'Tên không gian làm việc',
  create: {
    title: 'Tạo không gian làm việc',
    description: 'Dùng một tên ngắn, dễ nhận ra trên thanh tiêu đề.',
    placeholder: 'Thuật toán, Cơ sở dữ liệu, Hệ phân tán',
    submit: 'Tạo không gian làm việc',
    submitting: 'Đang tạo...',
  },
  manage: {
    title: 'Đổi tên hoặc xóa',
    description: 'Thay đổi áp dụng cho không gian làm việc hiện tại.',
    placeholder: 'Đổi tên không gian đang dùng',
    rename: 'Đổi tên không gian',
    delete: 'Xóa không gian làm việc',
  },
  deleteDialog: {
    eyebrow: 'Xác nhận xóa không gian làm việc',
    title: 'Xóa “{{name}}”?',
    description:
      'Chỉ có thể xóa không gian làm việc rỗng và không phải mặc định. Sau khi dịch vụ xác nhận, thao tác này không thể hoàn tác.',
  },
  notices: {
    created: {
      title: 'Đã tạo không gian làm việc',
      message: 'Đã tạo "{{name}}" và làm mới danh sách không gian làm việc.',
    },
    renamed: {
      title: 'Đã đổi tên không gian làm việc',
      message: 'Không gian đang dùng bây giờ là "{{name}}".',
    },
    deleted: {
      title: 'Đã xóa không gian làm việc',
      messageActive: 'Đã xóa "{{name}}" và làm mới danh sách không gian làm việc.',
      messageOther: 'Đã xóa "{{name}}" mà không thay đổi không gian làm việc đang dùng.',
    },
  },
  errors: {
    renameInvalidName: {
      title: 'Tên không gian làm việc không hợp lệ',
      message: 'Nhập tên không để trống và trong độ dài cho phép.',
    },
    renameNotFound: {
      title: 'Không tìm thấy không gian làm việc',
      message: 'Không gian này không còn tồn tại hoặc bạn không có quyền truy cập.',
    },
    renameOffline: {
      title: 'Không thể đổi tên không gian làm việc',
      message: 'Kiểm tra kết nối mạng và thử lại. Tên cũ được giữ nguyên.',
    },
    renameFailed: {
      title: 'Không thể đổi tên không gian làm việc',
      message: 'Tên cũ được giữ nguyên. Vui lòng thử lại sau.',
    },
    deleteDefaultForbidden: {
      title: 'Không thể xóa không gian mặc định',
      message: 'Không gian làm việc mặc định được bảo vệ.',
    },
    deleteNotEmpty: {
      title: 'Không gian làm việc vẫn còn video',
      message: 'Xóa hết video trong không gian này rồi thử lại.',
    },
    deleteNotFound: {
      title: 'Không tìm thấy không gian làm việc',
      message: 'Không gian này không còn tồn tại hoặc bạn không có quyền truy cập.',
    },
    deleteOffline: {
      title: 'Không thể xóa không gian làm việc',
      message: 'Kiểm tra kết nối mạng và thử lại. Không gian làm việc chưa được xóa.',
    },
    deleteFailed: {
      title: 'Không thể xóa không gian làm việc',
      message: 'Không gian làm việc chưa được xóa. Vui lòng thử lại sau.',
    },
  },
};

export const workspaces = { en, vi };
