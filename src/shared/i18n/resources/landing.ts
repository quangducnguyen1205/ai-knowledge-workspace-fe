/**
 * `landing` — the signed-out Moment Engine narrative.
 *
 * The chapter list is a fixed sequence owned by `features/public-landing`; this namespace holds
 * only its words. The capability names in the closing chapter are the shipped product surfaces —
 * no more, no less — so a translation names the same four capabilities and invents none.
 */

const en = {
  skipToContent: 'Skip to content',
  brand: 'AI Knowledge Workspace',
  brandHome: 'AI Knowledge Workspace home',
  accountNav: 'Account navigation',
  signIn: 'Sign in',
  getStarted: 'Get started',
  enterWorkspace: 'Enter workspace',
  seeHowItWorks: 'See how it works',
  openWorkspace: 'Open your workspace',
  exampleSearch: 'Example search: {{query}}',
  hero: {
    eyebrow: 'Video knowledge, made navigable',
    title: 'Find the exact moment in every video.',
    body: 'Turn long-form video into searchable knowledge. Search what was said, reopen the precise timestamp, and continue where the useful idea began.',
  },
  chapters: {
    transcriptLayers: {
      eyebrow: 'From footage to structure',
      title: 'Every spoken idea becomes searchable.',
      body: 'A video is no longer one long timeline. It becomes canonical transcript rows, timestamps and surrounding context that the workspace can navigate.',
    },
    workspaceSearch: {
      eyebrow: 'Workspace-wide search',
      title: 'Search across the whole workspace.',
      body: 'Find the idea even when you do not remember which video contained it.',
    },
    exactMoment: {
      eyebrow: 'The exact moment',
      title: 'Jump directly to the moment that matters.',
      body: 'Open the exact transcript row, see its canonical context, and seek to the matching timestamp.',
    },
    preserveTheMoment: {
      eyebrow: 'Saved Moments and progress',
      title: 'Save the moment. Return when it matters.',
      body: 'Keep canonical moments, copy their exact location, and continue watching from your last real position.',
    },
    enterTheWorkspace: {
      eyebrow: 'Start with your own videos',
      title: 'Your videos already contain the answer.',
      body: 'Make every moment searchable.',
    },
  },
  capabilities: {
    workspaceSearch: 'Workspace search',
    transcriptContext: 'Transcript context',
    savedMoments: 'Saved Moments',
    continueWatching: 'Continue Watching',
  },
};

const vi: typeof en = {
  skipToContent: 'Bỏ qua, tới nội dung chính',
  brand: 'AI Knowledge Workspace',
  brandHome: 'Trang chủ AI Knowledge Workspace',
  accountNav: 'Điều hướng tài khoản',
  signIn: 'Đăng nhập',
  getStarted: 'Bắt đầu',
  enterWorkspace: 'Vào không gian làm việc',
  seeHowItWorks: 'Xem cách hoạt động',
  openWorkspace: 'Mở không gian làm việc của bạn',
  exampleSearch: 'Ví dụ tìm kiếm: {{query}}',
  hero: {
    eyebrow: 'Tri thức từ video, tìm được ngay',
    title: 'Tìm đúng khoảnh khắc trong mọi video.',
    body: 'Biến video dài thành tri thức tìm kiếm được. Tìm điều đã được nói, mở lại đúng mốc thời gian và xem tiếp từ nơi ý tưởng bắt đầu.',
  },
  chapters: {
    transcriptLayers: {
      eyebrow: 'Từ thước phim thành cấu trúc',
      title: 'Mọi ý đã nói đều tìm được.',
      body: 'Video không còn là một dòng thời gian dài. Nó trở thành các đoạn bản chép lời gốc, mốc thời gian và ngữ cảnh xung quanh để không gian làm việc điều hướng.',
    },
    workspaceSearch: {
      eyebrow: 'Tìm kiếm toàn không gian làm việc',
      title: 'Tìm trên toàn bộ không gian làm việc.',
      body: 'Tìm ra ý tưởng ngay cả khi bạn không nhớ nó nằm trong video nào.',
    },
    exactMoment: {
      eyebrow: 'Đúng khoảnh khắc',
      title: 'Nhảy thẳng tới khoảnh khắc bạn cần.',
      body: 'Mở đúng đoạn bản chép lời, xem ngữ cảnh gốc của nó và tua tới đúng mốc thời gian.',
    },
    preserveTheMoment: {
      eyebrow: 'Khoảnh khắc đã lưu và tiến độ xem',
      title: 'Lưu khoảnh khắc. Quay lại khi cần.',
      body: 'Giữ lại những khoảnh khắc gốc, sao chép vị trí chính xác của chúng và xem tiếp từ đúng chỗ bạn đã dừng.',
    },
    enterTheWorkspace: {
      eyebrow: 'Bắt đầu với video của chính bạn',
      title: 'Câu trả lời đã nằm sẵn trong video của bạn.',
      body: 'Làm cho mọi khoảnh khắc đều tìm được.',
    },
  },
  capabilities: {
    workspaceSearch: 'Tìm kiếm toàn không gian',
    transcriptContext: 'Ngữ cảnh bản chép lời',
    savedMoments: 'Khoảnh khắc đã lưu',
    continueWatching: 'Tiếp tục xem',
  },
};

export const landing = { en, vi };
