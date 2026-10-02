const USERNAME_PATTERN = /^[A-Za-z0-9\p{Script=Han}]+$/u;
const USERNAME_MAX_LENGTH = 40;

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().normalize("NFKC");
}

export function usernameValidationError(username: string) {
  if (!username) return "请输入用户名";
  if (Array.from(username).length > USERNAME_MAX_LENGTH) {
    return `用户名不能超过${USERNAME_MAX_LENGTH}个字符`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "用户名只能包含中文、英文字母和数字";
  }
  return null;
}

export function normalizeAndValidateUsername(value: unknown) {
  const username = normalizeUsername(value);
  return { username, error: usernameValidationError(username) };
}
