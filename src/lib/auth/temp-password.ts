// 임시 비밀번호 생성(헷갈리는 글자 0·O·1·l·I 제외). 평문은 발급 화면에 한 번만 보여 주고 저장하지 않는다.
import crypto from "crypto";

export function generateTempPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let result = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}
