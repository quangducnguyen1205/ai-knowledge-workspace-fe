/** `home` — the signed-in Workspace home screen. */

const en = {
  hero: {
    title: 'Find the exact moment in every video.',
    statement:
      'Search across a workspace of videos and jump directly to the exact moments that matter — every video becomes a transcript you can search, revisit and resume.',
    summaryLabel: 'Workspace video summary',
    readyToSearch: '{{count}} ready to search',
    processing: '{{count}} processing',
    search: 'Search this workspace',
    addVideo: 'Add video',
    addFirstVideo: 'Add your first video',
    searchLocked: 'Search unlocks as soon as a transcript finishes processing.',
  },
  firstSteps: {
    eyebrow: 'First steps',
    title: 'From video to searchable moments',
    one: 'Add a video — upload a file or paste a YouTube link.',
    two: 'Its transcript is prepared automatically while you keep working.',
    three: 'Search what was said, open the exact timestamped moment, and save it.',
  },
  recent: {
    title: 'Recent videos',
    eyebrow: 'Library',
    pill: 'Latest first',
    emptyTitle: 'Your first video starts here',
    emptyDescription: 'Upload a file or add a YouTube URL and its transcript will appear in this workspace.',
  },
  scene: {
    label: 'Example of the product flow: a video becomes transcript layers, a search lands on the exact spoken moment, and that canonical row gets a stable link',
    example: 'Example',
    videoTitle: 'Learning Science Lecture',
    rowBefore: '…compared passive review with active recall.',
    rowHit: 'Retrieval practice strengthens memory by asking you to recall it.',
    rowAfter: 'That effect compounds when sessions are spaced.',
    link: 'Copy a stable link to this exact canonical row.',
    captionWelcome: 'From a video to the exact spoken moment.',
    captionProcessing: 'Search opens once a transcript finishes processing.',
    captionReturning: 'How search lands on the exact spoken moment.',
  },
  capabilities: {
    eyebrow: 'What this workspace does',
    title: 'Built for finding what was said',
    momentsTitle: 'Find exact moments',
    momentsBody:
      'Search spoken content across the workspace or inside one video, and jump straight to the timestamped row that matches.',
    contextTitle: 'Keep canonical context',
    contextBody:
      'Every moment opens with its surrounding transcript, and you can copy a stable link to the exact canonical row while the video stays in your workspace.',
    resumeTitle: 'Resume and save knowledge',
    resumeBody:
      'Playback progress is remembered per video, and saved moments keep the passages you want to find again.',
  },
};

const vi: typeof en = {
  hero: {
    title: 'Tìm đúng khoảnh khắc trong mọi video.',
    statement:
      'Tìm kiếm trên toàn bộ video trong không gian làm việc và nhảy thẳng tới đúng khoảnh khắc bạn cần — mỗi video trở thành một bản chép lời có thể tìm kiếm, xem lại và tiếp tục.',
    summaryLabel: 'Tổng quan video trong không gian làm việc',
    readyToSearch: '{{count}} sẵn sàng tìm kiếm',
    processing: '{{count}} đang xử lý',
    search: 'Tìm trong không gian này',
    addVideo: 'Thêm video',
    addFirstVideo: 'Thêm video đầu tiên',
    searchLocked: 'Tìm kiếm sẽ mở ngay khi có bản chép lời đầu tiên được xử lý xong.',
  },
  firstSteps: {
    eyebrow: 'Bắt đầu',
    title: 'Từ video thành những khoảnh khắc tìm được',
    one: 'Thêm video — tải tệp lên hoặc dán liên kết YouTube.',
    two: 'Bản chép lời được chuẩn bị tự động trong khi bạn tiếp tục làm việc.',
    three: 'Tìm nội dung đã nói, mở đúng khoảnh khắc theo mốc thời gian và lưu lại.',
  },
  recent: {
    title: 'Video gần đây',
    eyebrow: 'Thư viện',
    pill: 'Mới nhất trước',
    emptyTitle: 'Video đầu tiên của bạn bắt đầu từ đây',
    emptyDescription: 'Tải lên một tệp hoặc thêm một liên kết YouTube, bản chép lời sẽ xuất hiện trong không gian làm việc này.',
  },
  scene: {
    label: 'Minh họa luồng sản phẩm: một video trở thành các lớp bản chép lời, một lượt tìm kiếm rơi đúng vào khoảnh khắc đã nói, và đoạn gốc đó có một liên kết ổn định',
    example: 'Ví dụ',
    videoTitle: 'Bài giảng Khoa học học tập',
    rowBefore: '…so sánh việc đọc lại thụ động với việc chủ động nhớ lại.',
    rowHit: 'Việc chủ động nhớ lại giúp củng cố trí nhớ vì buộc bạn phải gợi lại kiến thức.',
    rowAfter: 'Hiệu quả đó còn tăng thêm khi các buổi học được giãn cách.',
    link: 'Sao chép liên kết ổn định tới đúng đoạn gốc này.',
    captionWelcome: 'Từ một video tới đúng khoảnh khắc đã nói.',
    captionProcessing: 'Tìm kiếm mở ra ngay khi một bản chép lời được xử lý xong.',
    captionReturning: 'Cách tìm kiếm rơi đúng vào khoảnh khắc đã nói.',
  },
  capabilities: {
    eyebrow: 'Không gian làm việc này làm được gì',
    title: 'Được xây dựng để tìm lại điều đã nói',
    momentsTitle: 'Tìm đúng khoảnh khắc',
    momentsBody:
      'Tìm nội dung đã nói trên toàn bộ không gian làm việc hoặc trong một video, rồi nhảy thẳng tới đoạn khớp theo mốc thời gian.',
    contextTitle: 'Giữ nguyên ngữ cảnh gốc',
    contextBody:
      'Mỗi khoảnh khắc mở ra cùng phần bản chép lời xung quanh, và bạn có thể sao chép liên kết ổn định tới đúng đoạn gốc trong khi video vẫn nằm trong không gian làm việc.',
    resumeTitle: 'Tiếp tục và lưu lại tri thức',
    resumeBody:
      'Tiến độ xem được ghi nhớ theo từng video, và khoảnh khắc đã lưu giữ lại những đoạn bạn muốn tìm lại.',
  },
};

export const home = { en, vi };
