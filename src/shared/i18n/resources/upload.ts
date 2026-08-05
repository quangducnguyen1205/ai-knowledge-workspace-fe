/** `upload` — the Add-video dialog and its two source forms. */

const en = {
  dialog: {
    title: 'Add video',
    close: 'Close add video dialog',
    sourceLegend: 'Video source',
    sourceUpload: 'Upload file',
    sourceYouTube: 'YouTube URL',
  },
  file: {
    intro: 'Choose a video to add to this workspace. You can leave the title blank to use its filename.',
    titleLabel: 'Video title',
    optional: '(optional)',
    titlePlaceholder: 'Leave blank to use the filename',
    fileLabel: 'Video file',
    hint: 'MP4, MOV, M4V, WebM, or AVI.',
    submit: 'Upload video',
    submitting: 'Uploading video...',
    selected: 'Selected',
    progressTitle: 'Uploading video',
    progressMessage: 'Adding the selected file to {{workspace}}. Keep this dialog open until the upload finishes.',
    chooseFirst: 'Choose a video before uploading.',
    unsupported: 'Choose an MP4, MOV, M4V, WebM, or AVI video.',
  },
  youtube: {
    intro: 'Add a public YouTube video to this workspace. Spring validates and normalizes the URL.',
    urlLabel: 'YouTube URL',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    urlHint: 'Use an HTTPS link to a public YouTube video.',
    titleLabel: 'Video title',
    titlePlaceholder: 'Leave blank to use the default title',
    submit: 'Add YouTube video',
    submitting: 'Adding YouTube video...',
    progressTitle: 'Adding YouTube video',
    progressMessage: 'Creating the video in {{workspace}}. Keep this dialog open until it is accepted.',
    urlRequired: 'Enter a YouTube video URL.',
    urlNotHttps: 'Use an HTTPS YouTube video URL.',
    defaultTitle: 'YouTube video',
  },
  errors: {
    unsupportedFormat: {
      title: 'Video format is not supported',
      message: 'Choose an MP4, MOV, M4V, WebM, or AVI video.',
    },
    uploadOffline: {
      title: 'Could not upload video',
      message: 'Check your connection and try again. The video was not uploaded.',
    },
    checkVideo: {
      title: 'Check this video',
      message: 'Check the video format and current workspace, then try again.',
    },
    processingUnavailable: {
      title: 'Video processing is unavailable',
      message: 'The video was not sent for processing. Try again later.',
    },
    youtubeInvalidUrl: {
      title: 'YouTube URL is not supported',
      message: 'Enter a supported public YouTube video URL.',
    },
    youtubeDuplicate: {
      title: 'Video already added',
      message: 'This YouTube video is already in the workspace.',
    },
    youtubeOffline: {
      title: 'Could not add YouTube video',
      message: 'Check your connection and try again. The video was not added.',
    },
  },
};

const vi: typeof en = {
  dialog: {
    title: 'Thêm video',
    close: 'Đóng hộp thoại thêm video',
    sourceLegend: 'Nguồn video',
    sourceUpload: 'Tải tệp lên',
    sourceYouTube: 'Liên kết YouTube',
  },
  file: {
    intro: 'Chọn một video để thêm vào không gian làm việc này. Bạn có thể để trống tiêu đề để dùng tên tệp.',
    titleLabel: 'Tiêu đề video',
    optional: '(không bắt buộc)',
    titlePlaceholder: 'Để trống để dùng tên tệp',
    fileLabel: 'Tệp video',
    hint: 'MP4, MOV, M4V, WebM hoặc AVI.',
    submit: 'Tải video lên',
    submitting: 'Đang tải video lên...',
    selected: 'Đã chọn',
    progressTitle: 'Đang tải video lên',
    progressMessage: 'Đang thêm tệp đã chọn vào {{workspace}}. Giữ hộp thoại này mở cho tới khi tải xong.',
    chooseFirst: 'Chọn một video trước khi tải lên.',
    unsupported: 'Chọn video định dạng MP4, MOV, M4V, WebM hoặc AVI.',
  },
  youtube: {
    intro: 'Thêm một video YouTube công khai vào không gian làm việc này. Spring sẽ kiểm tra và chuẩn hóa liên kết.',
    urlLabel: 'Liên kết YouTube',
    urlPlaceholder: 'https://www.youtube.com/watch?v=...',
    urlHint: 'Dùng liên kết HTTPS tới một video YouTube công khai.',
    titleLabel: 'Tiêu đề video',
    titlePlaceholder: 'Để trống để dùng tiêu đề mặc định',
    submit: 'Thêm video YouTube',
    submitting: 'Đang thêm video YouTube...',
    progressTitle: 'Đang thêm video YouTube',
    progressMessage: 'Đang tạo video trong {{workspace}}. Giữ hộp thoại này mở cho tới khi video được tiếp nhận.',
    urlRequired: 'Nhập liên kết video YouTube.',
    urlNotHttps: 'Dùng liên kết HTTPS tới video YouTube.',
    defaultTitle: 'Video YouTube',
  },
  errors: {
    unsupportedFormat: {
      title: 'Định dạng video không được hỗ trợ',
      message: 'Chọn video định dạng MP4, MOV, M4V, WebM hoặc AVI.',
    },
    uploadOffline: {
      title: 'Không thể tải video lên',
      message: 'Kiểm tra kết nối mạng và thử lại. Video chưa được tải lên.',
    },
    checkVideo: {
      title: 'Kiểm tra lại video này',
      message: 'Kiểm tra định dạng video và không gian làm việc hiện tại, rồi thử lại.',
    },
    processingUnavailable: {
      title: 'Dịch vụ xử lý video không khả dụng',
      message: 'Video chưa được gửi đi xử lý. Vui lòng thử lại sau.',
    },
    youtubeInvalidUrl: {
      title: 'Liên kết YouTube không được hỗ trợ',
      message: 'Nhập một liên kết video YouTube công khai được hỗ trợ.',
    },
    youtubeDuplicate: {
      title: 'Video đã được thêm',
      message: 'Video YouTube này đã có trong không gian làm việc.',
    },
    youtubeOffline: {
      title: 'Không thể thêm video YouTube',
      message: 'Kiểm tra kết nối mạng và thử lại. Video chưa được thêm.',
    },
  },
};

export const upload = { en, vi };
