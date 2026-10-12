export const AVATAR_CATALOG = [
  ["profile-01","강아지"],["profile-02","고양이"],["profile-03","토끼"],["profile-04","여우"],["profile-05","레서판다"],
  ["profile-06","쿼카"],["profile-07","펭귄"],["profile-08","판다"],["profile-09","고슴도치"],["profile-10","다람쥐"],
  ["profile-11","수달"],["profile-12","비버"],["profile-13","미어캣"],["profile-14","부엉이"],["profile-15","코알라"],
  ["profile-16","알파카"],["profile-17","물범"],["profile-18","햄스터"],["profile-19","카피바라"],["profile-20","너구리"],
  ["profile-21","북극여우"],["profile-22","날다람쥐"],["profile-23","앵무새"],["profile-24","늑대"],["profile-25","페럿"],
  ["profile-26","오리"],["profile-27","병아리"],["profile-28","곰"],["profile-29","호랑이"],["profile-30","사자"],
  ["profile-31","사슴"],["profile-32","원숭이"],["profile-33","돼지"],["profile-34","소"],["profile-35","말"],
  ["profile-36","시바견"],["profile-37","나무늘보"],["profile-38","거북이"],["profile-39","줄무늬다람쥐"],["profile-40","사막여우"]
].map(([key,label]) => ({ key, label }));

const AVATAR_KEYS = new Set(AVATAR_CATALOG.map((item) => item.key));

export function avatarSrc(key) {
  const avatar = String(key || "profile-01");
  if (AVATAR_KEYS.has(avatar)) return `/avatars/40/${avatar}.jpg`;
  const legacyVip = avatar.match(/^vip_0([1-6])$/);
  if (legacyVip) return `/avatars/40/profile-${String(Number(legacyVip[1])).padStart(2, "0")}.jpg`;
  return "/avatars/40/profile-01.jpg";
}

// 비밀번호 입력을 영문/대문자/한글 키보드 상태와 관계없이 같은 키 입력으로 맞춥니다.
export function normalizePasswordInput(value) {
  const initial = ["r","R","s","e","E","f","a","q","Q","t","T","d","w","W","c","z","x","v","g"];
  const medial = ["k","o","i","O","j","p","u","P","h","hk","ho","hl","y","n","nj","np","nl","b","m","ml","l"];
  const final = ["","r","R","rt","s","sw","sg","e","f","fr","fa","fq","ft","fx","fv","fg","a","q","qt","t","T","d","w","c","z","x","v","g"];
  const jamo = {
    "ㄱ":"r","ㄲ":"R","ㄴ":"s","ㄷ":"e","ㄸ":"E","ㄹ":"f","ㅁ":"a","ㅂ":"q","ㅃ":"Q","ㅅ":"t","ㅆ":"T","ㅇ":"d","ㅈ":"w","ㅉ":"W","ㅊ":"c","ㅋ":"z","ㅌ":"x","ㅍ":"v","ㅎ":"g",
    "ㅏ":"k","ㅐ":"o","ㅑ":"i","ㅒ":"O","ㅓ":"j","ㅔ":"p","ㅕ":"u","ㅖ":"P","ㅗ":"h","ㅘ":"hk","ㅙ":"ho","ㅚ":"hl","ㅛ":"y","ㅜ":"n","ㅝ":"nj","ㅞ":"np","ㅟ":"nl","ㅠ":"b","ㅡ":"m","ㅢ":"ml","ㅣ":"l"
  };

  let result = "";
  for (const ch of String(value || "")) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const first = Math.floor(offset / 588);
      const middle = Math.floor((offset % 588) / 28);
      const last = offset % 28;
      result += initial[first] + medial[middle] + final[last];
    } else {
      result += jamo[ch] || ch;
    }
  }
  return result.toLowerCase();
}
