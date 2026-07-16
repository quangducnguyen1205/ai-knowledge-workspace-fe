import { isApiClientError } from '../../../shared/api/api-error';
import type { AssetStatus, ProcessingJobStatus } from './types';

export type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

export function getFriendlyUploadErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_UPLOAD_FILE') {
    return {
      title: 'Tệp tải lên không được hỗ trợ',
      message: 'Chọn tệp video MP4, MOV, M4V, WebM hoặc AVI hợp lệ.',
    };
  }
  if (error.status === 0) {
    return { title: 'Chưa thể tải tệp lên', message: 'Kiểm tra kết nối mạng rồi thử lại. Tệp chưa được gửi đi xử lý.' };
  }
  if ([400, 409, 413, 415, 422].includes(error.status)) {
    return {
      title: 'Tệp tải lên chưa hợp lệ',
      message: 'Kiểm tra định dạng video và workspace đang chọn rồi thử lại.',
    };
  }
  if (error.code === 'PROCESSING_SERVICE_UNAVAILABLE' ||
      error.code === 'FASTAPI_INTEGRATION_ERROR' ||
      error.code === 'FASTAPI_CONNECTIVITY_ERROR') {
    return {
      title: 'Xử lý video tạm thời chưa sẵn sàng',
      message: 'Tệp chưa được gửi đi xử lý. Vui lòng thử lại sau.',
    };
  }
  return null;
}

export function getFriendlyDeleteErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Tài liệu đã được xóa',
      message: 'Danh sách workspace sẽ được làm mới để loại bỏ lựa chọn cũ.',
    };
  }
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return {
      tone: 'error',
      title: 'Chưa thể xóa tài liệu',
      message: 'Dịch vụ tìm kiếm tạm thời chưa sẵn sàng. Tài liệu vẫn được giữ nguyên.',
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Chưa thể xóa tài liệu', message: 'Kiểm tra kết nối mạng rồi thử lại. Tài liệu chưa bị xóa.' };
  }
  return {
    tone: 'error',
    title: 'Không thể xóa tài liệu',
    message: 'Tài liệu chưa bị xóa. Vui lòng thử lại sau.',
  };
}

export function getFriendlyRenameErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) return null;
  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return {
      tone: 'warning',
      title: 'Tiêu đề chưa hợp lệ',
      message: 'Nhập tiêu đề không để trống và nằm trong giới hạn cho phép.',
    };
  }
  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Không tìm thấy tài liệu',
      message: 'Tài liệu không còn tồn tại hoặc bạn không có quyền truy cập.',
    };
  }
  if (error.code === 'SEARCH_SERVICE_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_UNAVAILABLE' ||
      error.code === 'ELASTICSEARCH_INTEGRATION_ERROR') {
    return {
      tone: 'error',
      title: 'Chưa thể đổi tiêu đề',
      message: 'Dịch vụ tìm kiếm tạm thời chưa sẵn sàng nên tiêu đề cũ vẫn được giữ nguyên.',
    };
  }
  if (error.status === 0) {
    return { tone: 'error', title: 'Chưa thể đổi tiêu đề', message: 'Kiểm tra kết nối mạng rồi thử lại. Tiêu đề cũ vẫn được giữ nguyên.' };
  }
  return {
    tone: 'error',
    title: 'Không thể đổi tiêu đề',
    message: 'Tiêu đề cũ vẫn được giữ nguyên. Vui lòng thử lại sau.',
  };
}

export function getTranscriptConflictCopy(
  error: unknown,
  resolvedAssetStatus: AssetStatus | null,
  processingJobStatus?: ProcessingJobStatus,
): FriendlyMessageCopy | null {
  if (!(isApiClientError(error) && error.status === 409)) return null;
  if (resolvedAssetStatus === 'FAILED' || processingJobStatus === 'FAILED') {
    return {
      title: 'Transcript chưa khả dụng',
      message: 'Quá trình xử lý đã thất bại nên chưa có transcript để xem hoặc lập chỉ mục.',
    };
  }
  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Transcript đang được chuẩn bị',
      message: 'Quá trình xử lý đã hoàn tất nhưng transcript chưa sẵn sàng. Hãy chờ trước khi lập chỉ mục.',
    };
  }
  return {
    title: 'Transcript đang được chuẩn bị',
    message: 'Hãy chờ quá trình xử lý hoàn tất trước khi lập chỉ mục.',
  };
}

export function getAssetStatusDescription(status: AssetStatus | null): string {
  switch (status) {
    case 'PROCESSING': return 'Processing the source and preparing transcript content.';
    case 'TRANSCRIPT_READY': return 'Transcript is ready. Search indexing normally completes automatically.';
    case 'SEARCHABLE': return 'Indexed and searchable inside this workspace.';
    case 'FAILED': return 'Processing failed for this asset.';
    default: return 'Asset state not available yet.';
  }
}
