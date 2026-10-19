from pathlib import Path
import re

page_path = Path('app/page.js')
page = page_path.read_text()

page = page.replace(
    'import { AVATAR_CATALOG, avatarSrc, normalizePasswordInput } from "./lib/ui-helpers";',
    'import { AVATAR_CATALOG, avatarSrc } from "./lib/ui-helpers";'
)
page = page.replace('  const [password, setPassword] = useState("");\n', '')

signup_start = page.index('  async function handleSignup(e) {')
login_start = page.index('  async function handleLogin(e) {', signup_start)
send_start = page.index('  async function sendMessage(e) {', login_start)

new_signup = '''  async function handleSignup(e) {
    e.preventDefault();

    const cleanNickname = nickname.trim();
    const cleanRealName = realName.trim();

    if (!cleanNickname || !cleanRealName) {
      setNotice("닉네임과 이름을 모두 입력해주세요.");
      return;
    }

    setWorking(true);
    setNotice("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: cleanNickname, realName: cleanRealName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(result?.message || "가입 신청 중 오류가 발생했습니다.");
        return;
      }
      setNickname("");
      setRealName("");
      setMode("login");
      setNotice("가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
    } catch {
      setNotice("가입 신청 중 오류가 발생했습니다.");
    } finally {
      setWorking(false);
    }
  }

'''

new_login = '''  async function handleLogin(e) {
    e.preventDefault();

    const cleanNickname = nickname.trim();
    const cleanRealName = realName.trim();

    if (!cleanNickname || !cleanRealName) {
      setNotice("닉네임과 이름을 모두 입력해주세요.");
      return;
    }

    setWorking(true);
    setNotice("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: cleanNickname, realName: cleanRealName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.accessToken || !result?.refreshToken) {
        setNotice(result?.message || "닉네임 또는 이름을 확인해주세요.");
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error || !data?.user) {
        setNotice("닉네임 또는 이름을 확인해주세요.");
        return;
      }

      const { data: memberProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileError || !memberProfile) {
        await supabase.auth.signOut();
        setNotice("회원 정보를 확인할 수 없습니다.");
        return;
      }
      if (memberProfile.approval_status !== "approved") {
        await supabase.auth.signOut();
        setNotice("가입 승인이 완료된 후 로그인할 수 있습니다.");
        return;
      }

      const landingTab = memberProfile.role === "admin" ? "admin" : "private";
      if (typeof window !== "undefined") window.sessionStorage.setItem("vip-active-tab", landingTab);
      setChatTab(landingTab);
      setUser(data.user);
      setProfile(memberProfile);
      setVipLocked(false);
      if (typeof window !== "undefined") {
        const welcomeKey = `vip-welcome-seen-${data.user.id}`;
        setShowWelcomeModal(memberProfile.role !== "admin" && !window.localStorage.getItem(welcomeKey));
        window.localStorage.removeItem("vip-ui-locked");
        window.localStorage.setItem("vip-last-nickname", memberProfile.nickname || cleanNickname);
        window.localStorage.setItem("vip-last-avatar", memberProfile.avatar || "profile-01");
      } else {
        setShowWelcomeModal(memberProfile.role !== "admin");
      }
    } catch {
      setNotice("로그인 중 오류가 발생했습니다.");
    } finally {
      setWorking(false);
    }
  }

'''

page = page[:signup_start] + new_signup + new_login + page[send_start:]
page = page.replace(
    '<p style={styles.refProfileNote}>비밀번호는 보안상 화면에 표시되지 않습니다.</p>',
    '<p style={styles.refProfileNote}>회원 정보는 관리자 승인 기준으로 안전하게 관리됩니다.</p>'
)
page = page.replace(
    '// "로그아웃"은 VIP 화면만 잠그고 Supabase 인증 세션은 안전하게 유지합니다.\n    // 비밀번호를 localStorage에 저장하지 않으면서 빠른 재접속과 푸시 딥링크를 지원합니다.',
    '// "로그아웃"은 VIP 화면만 잠그고 Supabase 인증 세션은 안전하게 유지합니다.\n    // 민감한 인증 정보를 브라우저 저장소에 남기지 않으면서 빠른 재접속과 푸시 딥링크를 지원합니다.'
)

auth_return = page.rfind('\n  return (\n    <main style={styles.page}>')
if auth_return < 0:
    raise SystemExit('auth return block not found')
styles_start = page.index('\nconst styles = {', auth_return)
new_return = '''
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.luxLoginHero}>
          <div style={styles.goldLabel}>AI PROCESS · PRIVATE ACCESS</div>
          <h1 style={styles.title}>VIP MEMBER</h1>
          <p style={styles.description}>승인된 회원을 위한 전용 서비스입니다.</p>
          <div style={styles.luxHeroCaption}>MEMBER ACCESS · AI PROCESS</div>
        </header>

        <div style={styles.tabs}>
          <button type="button" onClick={() => { setMode("login"); setNotice(""); }} style={{ ...styles.tab, ...(mode === "login" ? styles.activeTab : {}) }}>로그인</button>
          <button type="button" onClick={() => { setMode("signup"); setNotice(""); }} style={{ ...styles.tab, ...(mode === "signup" ? styles.activeTab : {}) }}>가입 신청</button>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleSignup} style={styles.form}>
          <label style={styles.label}>닉네임</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} style={styles.input} autoComplete="username" placeholder={mode === "login" ? "가입한 닉네임" : "사용할 닉네임"} />
          <label style={styles.label}>이름</label>
          <input value={realName} onChange={(e) => setRealName(e.target.value)} style={styles.input} autoComplete="name" placeholder="가입한 이름" />
          <button type="submit" disabled={working} style={styles.primary}>{working ? "처리 중..." : mode === "login" ? "로그인" : "가입 신청하기"}</button>
        </form>

        {notice && <div style={styles.notice}>{notice}</div>}
        <div style={styles.footer}>PRIVATE MEMBER SERVICE · AI PROCESS</div>
      </section>
    </main>
  );
}
'''
page = page[:auth_return] + new_return + page[styles_start:]

replacements = {
'page': '''  page: {\n    minHeight: "100vh",\n    background: "#f5f7fa",\n    color: "#151b26",\n    display: "flex",\n    alignItems: "center",\n    justifyContent: "center",\n    padding: "24px 18px",\n    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',\n  },''',
'card': '''  card: {\n    width: "100%",\n    maxWidth: "430px",\n    background: "#ffffff",\n    border: "1px solid rgba(24,35,55,.12)",\n    borderRadius: "18px",\n    padding: "30px 24px 26px",\n    boxShadow: "0 18px 54px rgba(21,27,38,.08)",\n  },''',
'goldLabel': '''  goldLabel: {\n    color: "#526c91",\n    fontSize: "10px",\n    letterSpacing: "2.2px",\n    textAlign: "left",\n    fontWeight: "800",\n  },''',
'title': '''  title: {\n    textAlign: "left",\n    fontSize: "34px",\n    lineHeight: "1.05",\n    letterSpacing: "-.9px",\n    margin: "12px 0 10px",\n    color: "#182337",\n    fontWeight: "850",\n  },''',
'description': '''  description: {\n    color: "#596273",\n    textAlign: "left",\n    lineHeight: "1.65",\n    fontSize: "14px",\n    margin: 0,\n  },''',
'tabs': '''  tabs: {\n    display: "grid",\n    gridTemplateColumns: "1fr 1fr",\n    gap: 0,\n    background: "transparent",\n    padding: 0,\n    borderRadius: 0,\n    marginBottom: "26px",\n    borderBottom: "1px solid rgba(24,35,55,.12)",\n  },''',
'tab': '''  tab: {\n    border: 0,\n    borderBottom: "2px solid transparent",\n    background: "transparent",\n    color: "#818a98",\n    padding: "13px 4px 12px",\n    borderRadius: 0,\n    cursor: "pointer",\n    fontWeight: "750",\n    fontSize: "13px",\n  },''',
'activeTab': '''  activeTab: {\n    background: "transparent",\n    color: "#182337",\n    borderBottom: "2px solid #526c91",\n  },''',
'label': '''  label: {\n    fontSize: "11px",\n    color: "#596273",\n    margin: "0 0 7px 1px",\n    fontWeight: "700",\n    letterSpacing: ".2px",\n  },''',
'input': '''  input: {\n    boxSizing: "border-box",\n    width: "100%",\n    background: "#ffffff",\n    color: "#151b26",\n    border: "1px solid rgba(24,35,55,.16)",\n    borderRadius: "10px",\n    padding: "14px 13px",\n    marginBottom: "17px",\n    outline: "none",\n    fontSize: "16px",\n    touchAction: "manipulation",\n  },''',
'primary': '''  primary: {\n    background: "#182337",\n    color: "#ffffff",\n    border: 0,\n    borderRadius: "10px",\n    padding: "15px",\n    fontWeight: "800",\n    cursor: "pointer",\n    marginTop: "3px",\n  },''',
'notice': '''  notice: {\n    marginTop: "16px",\n    background: "#f7f9fc",\n    border: "1px solid rgba(82,108,145,.22)",\n    color: "#46566d",\n    borderRadius: "9px",\n    padding: "12px",\n    fontSize: "12px",\n    lineHeight: "1.55",\n    textAlign: "center",\n  },''',
'footer': '''  footer: {\n    color: "#818a98",\n    textAlign: "center",\n    fontSize: "9px",\n    letterSpacing: "1.55px",\n    marginTop: "24px",\n  },''',
'luxLoginHero': '''  luxLoginHero:{position:"relative",padding:"4px 0 24px",margin:"0 0 10px",borderRadius:0,overflow:"hidden",textAlign:"left",background:"transparent",border:0,borderBottom:"1px solid rgba(24,35,55,.10)",boxShadow:"none"},''',
'luxHeroCaption': '''  luxHeroCaption:{marginTop:"22px",paddingTop:"11px",borderTop:"1px solid rgba(24,35,55,.08)",color:"#818a98",fontSize:"9px",fontWeight:"800",letterSpacing:"1.6px",textAlign:"left"},''',
}
for key, value in replacements.items():
    pattern = rf'  {re.escape(key)}:\s*\{{.*?\n  \}},' if '\n' in value else rf'  {re.escape(key)}:\s*\{{.*?\}},'
    page, count = re.subn(pattern, value, page, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'failed to replace style {key}: {count}')

for token in ['VIP PRIVATE</h1>', 'profile-01.jpg" alt="AI PROCESS VIP"', 'type="password"', 'passwordCandidates', 'normalizePasswordInput']:
    if token in page:
        raise SystemExit(f'banned auth token remains in page.js: {token}')
page_path.write_text(page)

Path('app/api/auth/login/route.js').write_text('''import { NextResponse } from "next/server";\nimport { createClient } from "@supabase/supabase-js";\n\nfunction createAdminClient() {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n  const secretKey = process.env.SUPABASE_SECRET_KEY;\n  if (!url || !secretKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");\n  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });\n}\nfunction createLoginClient() {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;\n  if (!url || !publishableKey) throw new Error("Supabase 공개 환경변수가 설정되지 않았습니다.");\n  return createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });\n}\n\nexport async function POST(request) {\n  try {\n    const body = await request.json();\n    const nickname = String(body?.nickname || "").trim();\n    const realName = String(body?.realName || "").trim();\n    if (!nickname || !realName) return NextResponse.json({ message: "닉네임과 이름을 모두 입력해주세요." }, { status: 400 });\n\n    const admin = createAdminClient();\n    const { data: profile, error: profileError } = await admin.from("profiles").select("id,nickname,real_name,approval_status").eq("nickname", nickname).eq("real_name", realName).maybeSingle();\n    if (profileError) throw profileError;\n    if (!profile?.id) return NextResponse.json({ message: "닉네임 또는 이름을 확인해주세요." }, { status: 401 });\n    if (profile.approval_status !== "approved") return NextResponse.json({ message: "가입 승인이 완료된 후 로그인할 수 있습니다." }, { status: 403 });\n\n    const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);\n    const authEmail = authData?.user?.email;\n    if (authError || !authEmail) return NextResponse.json({ message: "회원 인증 정보를 확인할 수 없습니다." }, { status: 401 });\n\n    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: authEmail });\n    const tokenHash = linkData?.properties?.hashed_token;\n    if (linkError || !tokenHash) {\n      console.error("내부 로그인 링크 생성 오류:", linkError);\n      return NextResponse.json({ message: "로그인 인증을 만들지 못했습니다." }, { status: 500 });\n    }\n\n    const authClient = createLoginClient();\n    const { data, error } = await authClient.auth.verifyOtp({ token_hash: tokenHash, type: "email" });\n    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {\n      console.error("내부 로그인 세션 생성 오류:", error);\n      return NextResponse.json({ message: "로그인 인증에 실패했습니다." }, { status: 401 });\n    }\n    return NextResponse.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });\n  } catch (error) {\n    console.error("로그인 API 오류:", error);\n    return NextResponse.json({ message: "로그인 중 오류가 발생했습니다." }, { status: 500 });\n  }\n}\n''')

Path('app/api/auth/signup/route.js').write_text('''import { randomUUID } from "crypto";\nimport { NextResponse } from "next/server";\nimport { createClient } from "@supabase/supabase-js";\n\nconst RANDOM_PROFILE_KEYS = Array.from({ length: 40 }, (_, index) => `profile-${String(index + 1).padStart(2, "0")}`);\nfunction pickRandomProfile() { return RANDOM_PROFILE_KEYS[Math.floor(Math.random() * RANDOM_PROFILE_KEYS.length)]; }\nfunction createAdminClient() {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;\n  const secretKey = process.env.SUPABASE_SECRET_KEY;\n  if (!url || !secretKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");\n  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });\n}\nfunction makeInternalAuthAddress() { return `vip.${randomUUID().replaceAll("-", "")}@gmail.com`; }\nfunction makeInternalSecret() { return `${randomUUID()}-${randomUUID()}`; }\n\nexport async function POST(request) {\n  try {\n    const body = await request.json();\n    const nickname = String(body?.nickname || "").trim();\n    const realName = String(body?.realName || "").trim();\n    if (!nickname || !realName) return NextResponse.json({ message: "닉네임과 이름을 모두 입력해주세요." }, { status: 400 });\n\n    const admin = createAdminClient();\n    const { data: existingProfile, error: existingError } = await admin.from("profiles").select("id").eq("nickname", nickname).maybeSingle();\n    if (existingError) return NextResponse.json({ message: "가입 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });\n    if (existingProfile) return NextResponse.json({ message: "이미 사용 중인 닉네임입니다." }, { status: 409 });\n\n    const randomAvatar = pickRandomProfile();\n    const { data, error } = await admin.auth.admin.createUser({ email: makeInternalAuthAddress(), password: makeInternalSecret(), email_confirm: true, user_metadata: { nickname, real_name: realName, avatar: randomAvatar } });\n    if (error || !data?.user) return NextResponse.json({ message: "가입 신청 중 오류가 발생했습니다." }, { status: 400 });\n\n    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, nickname, real_name: realName, approval_status: "pending", avatar: randomAvatar }, { onConflict: "id" });\n    if (profileError) return NextResponse.json({ message: "프로필 생성 중 오류가 발생했습니다." }, { status: 500 });\n    return NextResponse.json({ ok: true });\n  } catch (error) {\n    console.error("가입 API 오류:", error);\n    return NextResponse.json({ message: "가입 신청 중 오류가 발생했습니다." }, { status: 500 });\n  }\n}\n''')
