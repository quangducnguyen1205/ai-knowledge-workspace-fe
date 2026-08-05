/**
 * `auth` — the sign-in and registration surfaces, plus the friendly copy that
 * `features/auth` maps a Spring authentication failure onto.
 *
 * The sign-in failure copy is deliberately non-enumerating: an unknown email, a wrong password
 * and an unusable credential all resolve to `signIn.invalidCredentials`, so translation must not
 * reintroduce the distinction the English copy exists to hide.
 */

const en = {
  register: {
    eyebrow: 'Get started',
    title: 'Create your account',
    subtitle: 'Create a workspace for your videos, transcripts, and cited answers.',
    submit: 'Create account',
    submitting: 'Creating account...',
    hint: 'You will be signed in when your account is ready.',
    switch: 'Create account',
    passwordPlaceholder: 'Create a secure password',
  },
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your workspace',
    subtitle: 'Continue where you left off.',
    submit: 'Sign in',
    submitting: 'Signing in...',
    hint: 'Your videos remain private to your account.',
    switch: 'Sign in',
    passwordPlaceholder: 'Enter your password',
  },
  fields: {
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
  },
  keycloak: {
    eyebrow: 'Welcome back',
    title: 'Continue to your workspace',
    subtitle: 'Use your organization account to continue to your workspace.',
    submit: 'Continue to sign in',
    submitting: 'Opening sign in...',
    notConfigured: {
      title: 'Sign in is not configured',
      message: 'The app cannot start sign in yet. Contact your administrator.',
    },
    unavailable: {
      title: 'Sign in is temporarily unavailable',
      message: 'The current sign-in method is not available. Try again later.',
    },
    incomplete: {
      title: 'Sign in was not completed',
      message: 'Try signing in again.',
    },
    modeUnavailable: 'Authentication mode is unavailable.',
  },
  errors: {
    offlineRegister: {
      title: 'Sign in is temporarily unavailable',
      message: 'Check your connection and try again. Your sign-in state has not changed.',
    },
    offlineLogout: {
      title: 'Could not sign out',
      message: 'Check your connection and try again. Your current session is still active.',
    },
    emailTaken: {
      title: 'Email already registered',
      message: 'Sign in with this email or use a different address.',
    },
    invalidCredentials: {
      title: 'Email or password is incorrect',
      message: 'Check your details and try again.',
    },
    invalidEmail: {
      title: 'Enter a valid email',
      message: 'Use a complete email address and try again.',
    },
    invalidPassword: {
      title: 'Password is not valid',
      message: 'Check the password requirements and try again.',
    },
    incompleteForm: {
      title: 'Complete the form',
      message: 'Check the fields and submit again.',
    },
    logoutFailed: {
      title: 'Could not sign out',
      message: 'Your current session is still active. Try again later.',
    },
    registerFailed: {
      title: 'Could not create account',
      message: 'Your account was not created. Try again later.',
    },
    loginFailed: {
      title: 'Could not sign in',
      message: 'Sign in was not completed. Try again later.',
    },
  },
};

const vi: typeof en = {
  register: {
    eyebrow: 'Bắt đầu',
    title: 'Tạo tài khoản của bạn',
    subtitle: 'Tạo một không gian làm việc cho video, bản chép lời và câu trả lời có trích dẫn.',
    submit: 'Tạo tài khoản',
    submitting: 'Đang tạo tài khoản...',
    hint: 'Bạn sẽ được đăng nhập ngay khi tài khoản sẵn sàng.',
    switch: 'Tạo tài khoản',
    passwordPlaceholder: 'Tạo một mật khẩu an toàn',
  },
  login: {
    eyebrow: 'Chào mừng trở lại',
    title: 'Đăng nhập vào không gian làm việc',
    subtitle: 'Tiếp tục từ nơi bạn đã dừng lại.',
    submit: 'Đăng nhập',
    submitting: 'Đang đăng nhập...',
    hint: 'Video của bạn chỉ hiển thị trong tài khoản của bạn.',
    switch: 'Đăng nhập',
    passwordPlaceholder: 'Nhập mật khẩu của bạn',
  },
  fields: {
    email: 'Email',
    emailPlaceholder: 'ban@congty.com',
    password: 'Mật khẩu',
  },
  keycloak: {
    eyebrow: 'Chào mừng trở lại',
    title: 'Tiếp tục vào không gian làm việc',
    subtitle: 'Dùng tài khoản của tổ chức để tiếp tục vào không gian làm việc.',
    submit: 'Tiếp tục đăng nhập',
    submitting: 'Đang mở trang đăng nhập...',
    notConfigured: {
      title: 'Đăng nhập chưa được cấu hình',
      message: 'Ứng dụng chưa thể bắt đầu đăng nhập. Liên hệ quản trị viên của bạn.',
    },
    unavailable: {
      title: 'Đăng nhập tạm thời không khả dụng',
      message: 'Phương thức đăng nhập hiện tại không khả dụng. Vui lòng thử lại sau.',
    },
    incomplete: {
      title: 'Đăng nhập chưa hoàn tất',
      message: 'Hãy thử đăng nhập lại.',
    },
    modeUnavailable: 'Phương thức xác thực không khả dụng.',
  },
  errors: {
    offlineRegister: {
      title: 'Đăng nhập tạm thời không khả dụng',
      message: 'Kiểm tra kết nối mạng và thử lại. Trạng thái đăng nhập của bạn không thay đổi.',
    },
    offlineLogout: {
      title: 'Không thể đăng xuất',
      message: 'Kiểm tra kết nối mạng và thử lại. Phiên làm việc hiện tại vẫn đang hoạt động.',
    },
    emailTaken: {
      title: 'Email đã được đăng ký',
      message: 'Đăng nhập bằng email này hoặc dùng một địa chỉ khác.',
    },
    invalidCredentials: {
      title: 'Email hoặc mật khẩu không đúng',
      message: 'Kiểm tra lại thông tin và thử lại.',
    },
    invalidEmail: {
      title: 'Nhập email hợp lệ',
      message: 'Dùng một địa chỉ email đầy đủ và thử lại.',
    },
    invalidPassword: {
      title: 'Mật khẩu không hợp lệ',
      message: 'Kiểm tra yêu cầu về mật khẩu và thử lại.',
    },
    incompleteForm: {
      title: 'Điền đầy đủ biểu mẫu',
      message: 'Kiểm tra các trường thông tin và gửi lại.',
    },
    logoutFailed: {
      title: 'Không thể đăng xuất',
      message: 'Phiên làm việc hiện tại vẫn đang hoạt động. Vui lòng thử lại sau.',
    },
    registerFailed: {
      title: 'Không thể tạo tài khoản',
      message: 'Tài khoản chưa được tạo. Vui lòng thử lại sau.',
    },
    loginFailed: {
      title: 'Không thể đăng nhập',
      message: 'Đăng nhập chưa hoàn tất. Vui lòng thử lại sau.',
    },
  },
};

export const auth = { en, vi };
