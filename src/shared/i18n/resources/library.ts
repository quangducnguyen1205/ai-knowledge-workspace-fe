/**
 * `library` — the video library screen, the Asset list and its row actions, the canonical status
 * and source badges, and the friendly copy `features/assets` maps a Spring failure onto.
 *
 * Status and source **labels** are localized; the underlying `AssetStatus` / `AssetSourceType`
 * values are Spring's contract and are never translated.
 */

const en = {
  screen: {
    title: 'Library',
    description: 'Manage the videos in this workspace.',
    addVideo: 'Add video',
    videos: 'Videos',
  },
  filters: {
    label: 'Filter videos',
    byStatus: 'Filter by status',
    byTitle: 'Filter videos by title',
    titlePlaceholder: 'Filter videos',
    all: 'All',
    ready: 'Ready',
    processing: 'Processing',
    preparingSearch: 'Preparing search',
    failed: 'Failed',
  },
  list: {
    loading: 'Loading videos...',
    emptyTitle: 'No videos found',
    emptyDescription: 'Add a file or YouTube URL to build this workspace.',
    emptyFiltered: 'Try a different title or status filter.',
    rowActions: 'Actions for {{title}}',
    rowActionsMenu: 'Video actions for {{title}}',
    renameLabel: 'New title for {{title}}',
  },
  status: {
    PROCESSING: 'Processing video',
    TRANSCRIPT_READY: 'Preparing search',
    SEARCHABLE: 'Ready',
    FAILED: 'Processing failed',
  },
  source: {
    UPLOAD: 'Upload',
    YOUTUBE: 'YouTube',
    unknown: 'Source unavailable',
  },
  notices: {
    deleted: {
      title: 'Video deleted',
      message: 'Removed "{{title}}" from {{workspace}}.',
    },
    renamed: {
      title: 'Video renamed',
      message: 'Title updated to "{{title}}".',
    },
    uploaded: {
      title: 'Video uploaded',
      message: 'Added "{{title}}" to {{workspace}}.',
    },
    youtubeAdded: {
      title: 'YouTube video added',
      message: 'Added "{{title}}" to {{workspace}}.',
    },
    fallbackWorkspace: 'the active workspace',
  },
  confirmDelete: 'Delete "{{title}}" from {{workspace}}?\n\nThis removes the asset and refreshes the workspace list.',
  confirmDeleteWorkspaceFallback: 'this workspace',
  errors: {
    deleteGone: {
      title: 'Video already deleted',
      message: 'The library will refresh to remove it.',
    },
    deleteSearchUnavailable: {
      title: 'Could not delete video',
      message: 'Search is temporarily unavailable. The video was not deleted.',
    },
    deleteOffline: {
      title: 'Could not delete video',
      message: 'Check your connection and try again. The video was not deleted.',
    },
    deleteFailed: {
      title: 'Could not delete video',
      message: 'The video was not deleted. Try again later.',
    },
    renameInvalidTitle: {
      title: 'Video title is not valid',
      message: 'Enter a non-empty title within the allowed length.',
    },
    renameNotFound: {
      title: 'Video not found',
      message: 'It no longer exists or you do not have access.',
    },
    renameSearchUnavailable: {
      title: 'Could not rename video',
      message: 'Search is temporarily unavailable, so the previous title was kept.',
    },
    renameOffline: {
      title: 'Could not rename video',
      message: 'Check your connection and try again. The previous title was kept.',
    },
    renameFailed: {
      title: 'Could not rename video',
      message: 'The previous title was kept. Try again later.',
    },
  },
};

const vi: typeof en = {
  screen: {
    title: 'Thư viện',
    description: 'Quản lý các video trong không gian làm việc này.',
    addVideo: 'Thêm video',
    videos: 'Video',
  },
  filters: {
    label: 'Lọc video',
    byStatus: 'Lọc theo trạng thái',
    byTitle: 'Lọc video theo tiêu đề',
    titlePlaceholder: 'Lọc video',
    all: 'Tất cả',
    ready: 'Sẵn sàng',
    processing: 'Đang xử lý',
    preparingSearch: 'Đang chuẩn bị tìm kiếm',
    failed: 'Thất bại',
  },
  list: {
    loading: 'Đang tải video...',
    emptyTitle: 'Không tìm thấy video nào',
    emptyDescription: 'Thêm một tệp hoặc liên kết YouTube để xây dựng không gian làm việc này.',
    emptyFiltered: 'Thử một tiêu đề hoặc bộ lọc trạng thái khác.',
    rowActions: 'Thao tác với {{title}}',
    rowActionsMenu: 'Thao tác video cho {{title}}',
    renameLabel: 'Tiêu đề mới cho {{title}}',
  },
  status: {
    PROCESSING: 'Đang xử lý video',
    TRANSCRIPT_READY: 'Đang chuẩn bị tìm kiếm',
    SEARCHABLE: 'Sẵn sàng',
    FAILED: 'Xử lý thất bại',
  },
  source: {
    UPLOAD: 'Tải lên',
    YOUTUBE: 'YouTube',
    unknown: 'Không rõ nguồn',
  },
  notices: {
    deleted: {
      title: 'Đã xóa video',
      message: 'Đã xóa "{{title}}" khỏi {{workspace}}.',
    },
    renamed: {
      title: 'Đã đổi tên video',
      message: 'Tiêu đề đã đổi thành "{{title}}".',
    },
    uploaded: {
      title: 'Đã tải video lên',
      message: 'Đã thêm "{{title}}" vào {{workspace}}.',
    },
    youtubeAdded: {
      title: 'Đã thêm video YouTube',
      message: 'Đã thêm "{{title}}" vào {{workspace}}.',
    },
    fallbackWorkspace: 'không gian làm việc hiện tại',
  },
  confirmDelete: 'Xóa "{{title}}" khỏi {{workspace}}?\n\nThao tác này gỡ video khỏi không gian làm việc và làm mới danh sách.',
  confirmDeleteWorkspaceFallback: 'không gian làm việc này',
  errors: {
    deleteGone: {
      title: 'Video đã được xóa trước đó',
      message: 'Thư viện sẽ được làm mới để bỏ video này.',
    },
    deleteSearchUnavailable: {
      title: 'Không thể xóa video',
      message: 'Tìm kiếm tạm thời không khả dụng. Video chưa được xóa.',
    },
    deleteOffline: {
      title: 'Không thể xóa video',
      message: 'Kiểm tra kết nối mạng và thử lại. Video chưa được xóa.',
    },
    deleteFailed: {
      title: 'Không thể xóa video',
      message: 'Video chưa được xóa. Vui lòng thử lại sau.',
    },
    renameInvalidTitle: {
      title: 'Tiêu đề video không hợp lệ',
      message: 'Nhập tiêu đề không để trống và trong độ dài cho phép.',
    },
    renameNotFound: {
      title: 'Không tìm thấy video',
      message: 'Video không còn tồn tại hoặc bạn không có quyền truy cập.',
    },
    renameSearchUnavailable: {
      title: 'Không thể đổi tên video',
      message: 'Tìm kiếm tạm thời không khả dụng nên tiêu đề cũ được giữ nguyên.',
    },
    renameOffline: {
      title: 'Không thể đổi tên video',
      message: 'Kiểm tra kết nối mạng và thử lại. Tiêu đề cũ được giữ nguyên.',
    },
    renameFailed: {
      title: 'Không thể đổi tên video',
      message: 'Tiêu đề cũ được giữ nguyên. Vui lòng thử lại sau.',
    },
  },
};

export const library = { en, vi };
