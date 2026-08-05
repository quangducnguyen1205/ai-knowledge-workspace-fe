/** `shell` — the authenticated application frame: brand, primary navigation, account menu. */

const en = {
  brand: {
    name: 'AI Knowledge Workspace',
    tagline: 'Video knowledge workspace',
    homeLabel: 'AI Knowledge Workspace home',
  },
  nav: {
    label: 'Primary navigation',
    menu: 'Menu',
    home: 'Home',
    library: 'Library',
    explore: 'Explore',
    libraryDisabled: 'Create or select a workspace before opening the video library.',
    exploreDisabled: 'Create or select a workspace before exploring video moments.',
  },
  workspaceSwitcher: {
    current: 'Current workspace',
    label: 'Workspace',
    empty: 'No workspace yet',
  },
  addVideo: {
    label: 'Add video',
    accessibleLabel: 'Add video to current workspace',
    disabled: 'Create or select a workspace before adding a video.',
  },
  account: {
    open: 'Open account menu',
    menu: 'Account menu',
    signedInAs: 'Signed in as',
    workspaceTools: 'Workspace tools',
    signOut: 'Sign out',
    signingOut: 'Signing out...',
    unknown: 'Unknown account',
  },
  status: {
    completingSignIn: 'Completing sign in...',
    checkingSession: 'Checking your session...',
    loadingWorkspaceScope: 'Loading authenticated workspace scope...',
    refreshingWorkspaceScope: 'Refreshing workspace scope...',
    resolvingAssetWorkspace: 'Resolving the authorized asset workspace...',
  },
  noWorkspace: {
    title: 'No workspace yet',
    description: 'Create a workspace to add your first video.',
    action: 'Open settings',
  },
};

const vi: typeof en = {
  brand: {
    name: 'AI Knowledge Workspace',
    tagline: 'Không gian tri thức từ video',
    homeLabel: 'Trang chủ AI Knowledge Workspace',
  },
  nav: {
    label: 'Điều hướng chính',
    menu: 'Menu',
    home: 'Trang chủ',
    library: 'Thư viện',
    explore: 'Khám phá',
    libraryDisabled: 'Tạo hoặc chọn một không gian làm việc trước khi mở thư viện video.',
    exploreDisabled: 'Tạo hoặc chọn một không gian làm việc trước khi khám phá khoảnh khắc video.',
  },
  workspaceSwitcher: {
    current: 'Không gian làm việc hiện tại',
    label: 'Không gian làm việc',
    empty: 'Chưa có không gian làm việc',
  },
  addVideo: {
    label: 'Thêm video',
    accessibleLabel: 'Thêm video vào không gian làm việc hiện tại',
    disabled: 'Tạo hoặc chọn một không gian làm việc trước khi thêm video.',
  },
  account: {
    open: 'Mở menu tài khoản',
    menu: 'Menu tài khoản',
    signedInAs: 'Đang đăng nhập với',
    workspaceTools: 'Công cụ không gian làm việc',
    signOut: 'Đăng xuất',
    signingOut: 'Đang đăng xuất...',
    unknown: 'Tài khoản không xác định',
  },
  status: {
    completingSignIn: 'Đang hoàn tất đăng nhập...',
    checkingSession: 'Đang kiểm tra phiên làm việc...',
    loadingWorkspaceScope: 'Đang tải các không gian làm việc của bạn...',
    refreshingWorkspaceScope: 'Đang làm mới không gian làm việc...',
    resolvingAssetWorkspace: 'Đang xác định không gian làm việc của video...',
  },
  noWorkspace: {
    title: 'Chưa có không gian làm việc',
    description: 'Tạo một không gian làm việc để thêm video đầu tiên của bạn.',
    action: 'Mở cài đặt',
  },
};

export const shell = { en, vi };
