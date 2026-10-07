"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

const ROOM_ID = "0a495a02-bcb8-4e38-b3ef-4e7059c2a883";

const AVATAR_CATALOG = [
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

function avatarSrc(key) {
  const avatar = String(key || "profile-01");
  if (AVATAR_KEYS.has(avatar)) return `/avatars/40/${avatar}.jpg`;
  const legacyVip = avatar.match(/^vip_0([1-6])$/);
  if (legacyVip) return `/avatars/40/profile-${String(Number(legacyVip[1])).padStart(2, "0")}.jpg`;
  return "/avatars/40/profile-01.jpg";
}

// 비밀번호 입력을 영문/대문자/한글 키보드 상태와 관계없이 같은 키 입력으로 맞춥니다.
function normalizePasswordInput(value) {
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

export default function Home() {
  const [mode, setMode] = useState("login");

  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [memberAvatars, setMemberAvatars] = useState({});
  const [approvedMemberCount, setApprovedMemberCount] = useState(0);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [message, setMessage] = useState("");
  const [showGroupEmoji, setShowGroupEmoji] = useState(false);
  const [showPrivateEmoji, setShowPrivateEmoji] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);

  const [chatTab, setChatTab] = useState("private");
  const [privateChatId, setPrivateChatId] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateMessage, setPrivateMessage] = useState("");

  const [adminChats, setAdminChats] = useState([]);
  const [adminMembers, setAdminMembers] = useState([]);
  const [adminAllMembers, setAdminAllMembers] = useState([]);
  const [adminMemberLoadError, setAdminMemberLoadError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [adminMemberFilter, setAdminMemberFilter] = useState("all");
  const [selectedAdminChat, setSelectedAdminChat] = useState(null);

  const [adminUnreadCounts, setAdminUnreadCounts] = useState({});
  const [memberUnreadCount, setMemberUnreadCount] = useState(0);
  const [chatFrozen, setChatFrozen] = useState(false);
  const [freezeWorking, setFreezeWorking] = useState(false);
  const [chatClockTick, setChatClockTick] = useState(0);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [privateAlert, setPrivateAlert] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [adminIdentity, setAdminIdentity] = useState({ nickname: "관리자", avatar: "profile-01" });
  const [vipLocked, setVipLocked] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [aiSession, setAiSession] = useState(null);
  const [aiSessions, setAiSessions] = useState([]);
  const [aiSelectedProcessId, setAiSelectedProcessId] = useState("");
  const [aiPublicSessions, setAiPublicSessions] = useState([]);
  const [aiPublicLoading, setAiPublicLoading] = useState(false);
  const [aiAdminMemberId, setAiAdminMemberId] = useState("");
  const [aiAdminAmount, setAiAdminAmount] = useState("5000000");
  const [aiAdminDurationHours, setAiAdminDurationHours] = useState("24");
  const [aiAdminIndefinite, setAiAdminIndefinite] = useState(false);
  const [aiAdminWorking, setAiAdminWorking] = useState(false);
  const [aiAccountsWorking, setAiAccountsWorking] = useState(false);

  const [autoEvents, setAutoEvents] = useState([]);
  const [eventWorkingId, setEventWorkingId] = useState(null);
  const [eventAnswers, setEventAnswers] = useState({});
  const [rouletteSpins, setRouletteSpins] = useState({});
  const [eventSuccess, setEventSuccess] = useState(null);

  const [aiSim, setAiSim] = useState(null);
  const [aiSimLoading, setAiSimLoading] = useState(false);
  const [aiSimError, setAiSimError] = useState("");
  const [aiNextUpdate, setAiNextUpdate] = useState(null);
  const [aiCountdown, setAiCountdown] = useState("05:00");

  const messagesRef = useRef(null);
  const groupMessagesRef = useRef(null);
  const privateMessagesRef = useRef(null);
  const groupBottomRef = useRef(null);
  const privateBottomRef = useRef(null);
  const groupEmojiRef = useRef(null);
  const privateEmojiRef = useRef(null);

  const AI_START_MONEY = 5000000;
  const AI_REFRESH_MS = 60 * 1000;
  const AI_PROFIT_CHANCE = 0.85;

  async function refreshPushStatus() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushEnabled(false);
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        setPushEnabled(false);
        return false;
      }
      const subscription = await registration.pushManager.getSubscription();
      const enabled = Notification.permission === "granted" && Boolean(subscription);
      setPushEnabled(enabled);
      return enabled;
    } catch {
      setPushEnabled(false);
      return false;
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  function isIOSDevice() {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  async function installVipApp() {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;

    if (standalone) {
      setIsStandaloneApp(true);
      setNotice("이미 홈 화면 앱으로 실행 중입니다.");
      return;
    }

    // Android Chrome/Edge/Samsung Internet에서 브라우저가 설치 가능하다고 판단하면
    // beforeinstallprompt 객체를 사용해 시스템 설치창을 즉시 엽니다.
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === "accepted") {
          setNotice("AI PROCESS VIP 앱 설치를 진행합니다.");
        } else {
          setNotice("앱 설치가 취소되었습니다.");
        }
        setInstallPrompt(null);
        return;
      } catch (error) {
        console.error("앱 설치창 실행 오류:", error);
      }
    }

    // iPhone은 시스템상 beforeinstallprompt가 없으므로 Safari의 홈 화면 추가 안내가 필요합니다.
    if (isIOSDevice()) {
      setShowInstallGuide(true);
      return;
    }

    // Android에서 여기로 오면 현재 브라우저가 install prompt를 제공하지 않은 상태입니다.
    setShowInstallGuide(true);
    setNotice("설치창을 준비할 수 없습니다. Chrome/Samsung Internet에서 새로고침 후 다시 눌러주세요.");
  }

  async function enablePrivateNotifications() {
    if (typeof window === "undefined" || !user) {
      setNotice("로그인 후 알림을 설정해주세요.");
      return false;
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;

    const iosLike =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (iosLike && !standalone) {
      setNotice("아이폰은 홈 화면의 VIP 아이콘으로 실행한 뒤 🔔 알림을 눌러주세요.");
      setShowInstallGuide(true);
      return false;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotice("이 기기 또는 현재 브라우저에서는 Web Push를 사용할 수 없습니다.");
      return false;
    }

    try {
      // iPhone 핵심:
      // requestPermission() 전에 다른 비동기 작업(await)을 하지 않습니다.
      // 사용자가 🔔 버튼을 누른 바로 그 제스처에서 권한창을 요청합니다.
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission === "denied") {
        setPushEnabled(false);
        setNotice("알림 권한이 차단되어 있습니다. 휴대폰 설정 → 알림 → AI PROCESS VIP에서 알림을 허용해주세요.");
        return false;
      }

      if (permission !== "granted") {
        setPushEnabled(false);
        setNotice("알림 권한이 허용되지 않았습니다.");
        return false;
      }

      // 버전 문자열로 오래된 서비스워커 캐시를 강제로 벗어납니다.
      const registration = await navigator.serviceWorker.register(
        "/sw.js?v=20261001-4",
        { scope: "/", updateViaCache: "none" }
      );

      await registration.update().catch(() => {});

      // registration 자체를 사용합니다. navigator.serviceWorker.ready를 무기한 기다리지 않습니다.
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("VAPID 공개키가 설정되지 않았습니다.");

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("푸시 구독 정보를 만들지 못했습니다.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) throw error;

      setPushEnabled(true);
      setNotice("🔔 1:1 알림이 정상적으로 켜졌습니다.");
      return true;
    } catch (error) {
      console.error("푸시 알림 설정 오류:", error);
      setPushEnabled(false);
      setNotice(`알림 설정 실패: ${error?.message || "알 수 없는 오류"}`);
      return false;
    }
  }

  async function sendPrivatePush(chatId, content) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      await fetch("/api/push/private-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatId,
          content: String(content || "").startsWith("[[IMAGE]]")
            ? "사진을 보냈습니다."
            : String(content || ""),
        }),
      });
    } catch (error) {
      console.error("푸시 발송 요청 오류:", error);
    }
  }

  function showPrivateIncomingAlert(payload) {
    if (!payload || payload.sender_id === user?.id) return;

    const body = String(payload.content || "").startsWith("[[IMAGE]]")
      ? "사진을 보냈습니다."
      : String(payload.content || "새 1:1 메시지가 도착했습니다.");

    setPrivateAlert({ title: `${adminIdentity.nickname || "관리자"} 1:1 문의`, body });
    window.clearTimeout(window.__vipPrivateAlertTimer);
    window.__vipPrivateAlertTimer = window.setTimeout(() => setPrivateAlert(null), 4200);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification("AI PROCESS VIP · 1:1 새 메시지", {
          body,
          icon: "/avatars/40/profile-01.jpg",
          tag: "vip-private-message"
        });
        n.onclick = () => {
          window.focus();
          setChatTab("private");
          window.sessionStorage.setItem("vip-active-tab", "private");
          n.close();
        };
      } catch (_) {}
    }
  }

  function aiKrw(value) {
    return `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
  }

  function aiTime(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function aiStartMoney() {
    return Number(aiSession?.start_amount || AI_START_MONEY);
  }

  function aiStorageKey() {
    const sessionKey = aiSession?.started_at ? new Date(aiSession.started_at).getTime() : "observer";
    return `vip-ai-hindsight-v4-${user?.id || "guest"}-${sessionKey}`;
  }


  function hydrateAiSimulationFromStorage() {
    if (!user || typeof window === "undefined") return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(aiStorageKey()) || "null");
      if (!saved?.startedAt) return;

      const startMoney = aiStartMoney();
      const portfolioValue = Number(saved.portfolioValue || startMoney);
      const totalProfit = portfolioValue - startMoney;
      const totalReturn = startMoney > 0 ? (totalProfit / startMoney) * 100 : 0;
      const endAt =
        new Date(saved.startedAt).getTime() +
        Number(saved.durationHours || 1) * 60 * 60 * 1000;
      const remainingMs = Math.max(0, endAt - Date.now());

      setAiSim({
        ...saved,
        portfolioValue,
        totalProfit,
        totalReturn,
        completed: remainingMs <= 0,
        remainingHours: Math.ceil(remainingMs / 3600000),
        updatedAt: saved.lastMarketAt || saved.startedAt,
      });
    } catch (error) {
      console.error("저장된 AI 기록 불러오기 오류:", error);
    }
  }

  function makeAiDurationHours() {
    const seed = Array.from(user?.id || "vip")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 1 + (seed % 720);
  }

  function aiSignedKrw(value) {
    const n = Number(value || 0);
    return `${n >= 0 ? "+" : "-"}${aiKrw(Math.abs(n))}`;
  }

  function aiSignedPct(value, digits = 3) {
    const n = Number(value || 0);
    return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
  }

  function aiFormatMarketPrice(item) {
    const value = Number(item?.price || item?.currentPrice || 0);
    if (!Number.isFinite(value)) return "-";
    if (item?.type === "crypto") {
      if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
      if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
    }
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function aiRemainingText(sim) {
    if (!sim?.startedAt) return "준비 중";
    const endAt = new Date(sim.startedAt).getTime() + Number(sim.durationHours || 1) * 3600000;
    const remain = Math.max(0, endAt - Date.now());
    if (!remain) return "완료";
    const days = Math.floor(remain / 86400000);
    const hours = Math.floor((remain % 86400000) / 3600000);
    const minutes = Math.floor((remain % 3600000) / 60000);
    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${Math.max(1, minutes)}분`;
  }

  function aiSeedRoll(seedText) {
    let hash = 2166136261;
    for (const ch of String(seedText || "")) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  function buildAiChartModel(history, startMoney = AI_START_MONEY) {
    const rows = Array.isArray(history) ? history.slice(-48) : [];
    const width = 900;
    const height = 300;
    const padX = 52;
    const padY = 28;
    if (!rows.length) {
      return { width, height, nodes: [], points: "", areaPath: "", baselineY: height / 2, min: startMoney, max: startMoney };
    }

    const values = rows.map((row) => Number(row.value || startMoney)).filter(Number.isFinite);
    const rawMin = Math.min(startMoney, ...values);
    const rawMax = Math.max(startMoney, ...values);
    const rawRange = Math.max(rawMax - rawMin, Math.max(startMoney * 0.002, 1));
    const min = rawMin - rawRange * 0.12;
    const max = rawMax + rawRange * 0.12;
    const range = Math.max(max - min, 1);

    const nodes = rows.map((row, index) => {
      const value = Number(row.value || startMoney);
      const x = rows.length === 1
        ? width / 2
        : padX + (index / (rows.length - 1)) * (width - padX * 2);
      const y = padY + ((max - value) / range) * (height - padY * 2);
      return { ...row, value, x, y };
    });
    const points = nodes.map((node) => `${node.x.toFixed(1)},${node.y.toFixed(1)}`).join(" ");
    const bottom = height - padY;
    const areaPath = nodes.length
      ? `M ${nodes[0].x.toFixed(1)} ${bottom} L ${nodes.map((node) => `${node.x.toFixed(1)} ${node.y.toFixed(1)}`).join(" L ")} L ${nodes[nodes.length - 1].x.toFixed(1)} ${bottom} Z`
      : "";
    const baselineY = padY + ((max - startMoney) / range) * (height - padY * 2);
    return { width, height, nodes, points, areaPath, baselineY, min, max };
  }

  async function loadAiProcessState() {
    if (!user) return;
    const needPublicSessions = profile?.role === "admin" || chatTab === "ai";
    if (needPublicSessions) setAiPublicLoading(true);
    try {
      const minePromise = supabase
        .from("ai_process_sessions")
        .select("id,user_id,status,start_amount,current_amount,total_profit,total_return,duration_hours,started_at,ends_at,completed_at,last_market_at,last_asset_symbol,last_asset_name,last_asset_type,last_market_pct,last_delta,last_tick_at,updated_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      const publicPromise = needPublicSessions
        ? supabase.rpc("get_ai_process_public_sessions")
        : Promise.resolve({ data: null, error: null });
      const [{ data: mineRows, error: mineError }, { data: publicRows, error: publicError }] = await Promise.all([minePromise, publicPromise]);
      if (mineError) console.error("AI PROCESS 내 세션 조회 오류:", mineError);
      if (publicError) console.error("AI PROCESS 공개 현황 조회 오류:", publicError);

      const directRows = Array.isArray(mineRows) ? mineRows : [];
      const publicList = Array.isArray(publicRows) ? publicRows : [];
      const publicMine = publicList
        .filter((row) => row.user_id === user.id)
        .map((row) => ({ ...row, id: row.id || row.process_id }));
      const rows = directRows.length ? directRows : publicMine;
      setAiSessions(rows);
      const preferredId = aiSelectedProcessId && rows.some((row) => row.id === aiSelectedProcessId)
        ? aiSelectedProcessId
        : (rows.find((row) => row.status === "running")?.id || rows[0]?.id || "");
      if (preferredId !== aiSelectedProcessId) setAiSelectedProcessId(preferredId);
      const selected = rows.find((row) => row.id === preferredId)
        || publicMine.find((row) => row.status === "running")
        || null;
      setAiSession(selected);
      if (needPublicSessions) setAiPublicSessions(publicList);
    } finally {
      if (needPublicSessions) setAiPublicLoading(false);
    }
  }

  async function adminStartAiProcess() {
    if (profile?.role !== "admin" || !aiAdminMemberId || aiAdminWorking) return;
    const amount = Number(String(aiAdminAmount).replace(/,/g, ""));
    const duration = aiAdminIndefinite ? 0 : Number(aiAdminDurationHours);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice("운용금액을 확인해주세요."); return; }
    if (!aiAdminIndefinite && (!Number.isFinite(duration) || duration < 1 || duration > 720)) { setNotice("진행시간은 1시간~720시간(30일)으로 설정해주세요."); return; }
    setAiAdminWorking(true);
    try {
      const { error } = await supabase.rpc("admin_start_ai_process", {
        target_user_id: aiAdminMemberId,
        starting_amount: amount,
        process_duration_hours: Math.floor(duration)
      });
      if (error) throw error;
      setNotice("AI PROCESS를 시작했습니다.");
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setNotice(`AI PROCESS 시작 실패: ${error.message || "오류"}`);
    } finally {
      setAiAdminWorking(false);
    }
  }

  async function adminStopAiProcess(targetProcessId) {
    if (profile?.role !== "admin" || !targetProcessId || aiAdminWorking) return;
    setAiAdminWorking(true);
    try {
      const { error } = await supabase.rpc("admin_stop_ai_process", { target_process_id: targetProcessId });
      if (error) throw error;
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setNotice(`AI PROCESS 종료 실패: ${error.message || "오류"}`);
    } finally { setAiAdminWorking(false); }
  }

  async function updateAiSimulation() {
    if (!user || aiSimLoading) return;

    setAiSimLoading(true);
    setAiSimError("");

    try {
      const marketPromise = fetch("/api/market-sim", { cache: "no-store" });
      const logsPromise = aiSession?.id
        ? supabase
            .from("ai_process_logs")
            .select("process_id,market_at,asset_symbol,asset_name,asset_type,market_pct,amount_before,delta,amount_after,result_type")
            .eq("process_id", aiSession.id)
            .order("market_at", { ascending: false })
            .limit(120)
        : Promise.resolve({ data: [], error: null });

      const [marketResponse, logsResult] = await Promise.all([marketPromise, logsPromise]);
      const raw = await marketResponse.text();
      let marketResult = null;
      try {
        marketResult = JSON.parse(raw);
      } catch {
        throw new Error("시장 데이터 응답 형식을 확인해주세요.");
      }

      if (!marketResponse.ok || !marketResult?.success || !marketResult?.quotes?.length) {
        throw new Error(marketResult?.error || "시장 데이터를 불러오지 못했습니다.");
      }
      if (logsResult?.error) console.error("AI PROCESS 연동기록 조회 오류:", logsResult.error);

      const quotes = marketResult.quotes.map((item) => ({
        ...item,
        price: Number(item.price),
        beforePrice: Number(item.beforePrice ?? item.price),
        changePct: Number(item.changePct || 0),
      }));
      const logRows = Array.isArray(logsResult?.data) ? logsResult.data : [];
      const results = logRows.map((row) => ({
        at: row.market_at,
        symbol: row.asset_symbol,
        name: row.asset_name,
        type: row.asset_type,
        intervalPct: Number(row.market_pct || 0),
        intervalProfit: Number(row.delta || 0),
        allocatedKrw: Number(row.amount_before || 0),
        portfolioValue: Number(row.amount_after || 0),
        resultType: row.result_type || "wait",
      }));
      const history = [...results].reverse().map((row) => ({
        at: row.at,
        value: row.portfolioValue,
        delta: row.intervalProfit,
        resultType: row.resultType,
        symbol: row.symbol,
        name: row.name,
        marketPct: row.intervalPct,
      }));

      if (aiSession?.started_at && (!history.length || history[0]?.at !== aiSession.started_at)) {
        history.unshift({
          at: aiSession.started_at,
          value: Number(aiSession.start_amount || AI_START_MONEY),
          delta: 0,
          resultType: "start",
          name: "AI PROCESS 시작",
        });
      }

      const startMoney = Number(aiSession?.start_amount || AI_START_MONEY);
      const portfolioValue = Number(aiSession?.current_amount || startMoney);
      const totalProfit = portfolioValue - startMoney;
      const totalReturn = startMoney > 0 ? (totalProfit / startMoney) * 100 : 0;

      setAiSim({
        startedAt: aiSession?.started_at || marketResult.updatedAt,
        durationHours: Number(aiSession?.duration_hours || 24),
        portfolioValue,
        totalProfit,
        totalReturn,
        marketRows: quotes,
        resultHistory: results,
        history,
        lastMarketAt: aiSession?.last_market_at || marketResult.updatedAt,
        updatedAt: aiSession?.updated_at || marketResult.updatedAt,
      });
      setAiNextUpdate(new Date(Date.now() + AI_REFRESH_MS).toISOString());

      // market route가 서버 엔진을 실행했을 수 있으므로 최신 세션 값을 다시 읽습니다.
      await loadAiProcessState();
    } catch (error) {
      console.error(error);
      setAiSimError(error.message || "시장 결과 분석 중 오류가 발생했습니다.");
    } finally {
      setAiSimLoading(false);
    }
  }

  useEffect(() => {
    if (!user || !profile) return;
    if (!["ai", "home", "admin", "members"].includes(chatTab)) return;
    loadAiProcessState();
  }, [user?.id, profile?.role, aiSelectedProcessId, chatTab]);

  useEffect(() => {
    if (!user || !profile) return;
    if (chatTab !== "ai" && chatTab !== "home") return;

    updateAiSimulation();

    const refreshVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        updateAiSimulation();
        loadAutoEvents();
      }
    };
    const timer = setInterval(refreshVisible, AI_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshVisible();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, profile?.role, aiSession?.id, aiSession?.status, chatTab]);

  useEffect(() => {
    if (profile?.role === "admin" && (chatTab === "ai" || chatTab === "admin" || chatTab === "members" || chatTab === "private")) {
      loadAdminMembers();
      loadAdminAllMembers();
    }
  }, [chatTab, profile?.role, user?.id]);

  useEffect(() => {
    if (!user || profile?.role !== "admin") return;
    const refreshAdminDashboard = () => {
      Promise.all([loadAdminAllMembers(), loadAdminMembers(), loadMemberNames(), loadAdminUnreadCounts()]).catch(() => {});
    };
    refreshAdminDashboard();
    const timer = setInterval(refreshAdminDashboard, 15000);
    return () => clearInterval(timer);
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (chatTab !== "ai" || !aiNextUpdate) return;

    const tick = () => {
      const remain = Math.max(0, new Date(aiNextUpdate).getTime() - Date.now());
      const min = Math.floor(remain / 60000);
      const sec = Math.floor((remain % 60000) / 1000);
      setAiCountdown(
        `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [chatTab, aiNextUpdate]);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js?v=20261001-4",
          { scope: "/", updateViaCache: "none" }
        );
        await registration.update().catch(() => {});
        if (!cancelled) {
          console.log("VIP service worker ready:", registration.scope);
        }
      } catch (error) {
        console.error("VIP service worker register error:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStandalone = () => {
      setIsStandaloneApp(Boolean(
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true
      ));
    };

    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const installed = () => {
      setInstallPrompt(null);
      setIsStandaloneApp(true);
      setShowInstallGuide(false);
      setNotice("AI PROCESS VIP가 홈 화면에 설치되었습니다.");
    };

    updateStandalone();
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshPushStatus();
  }, [user]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onServiceWorkerMessage = (event) => {
      if (event?.data?.type !== "VIP_OPEN_PRIVATE") return;

      setVipLocked(false);
      setChatTab("private");
      window.localStorage.removeItem("vip-ui-locked");
      window.sessionStorage.setItem("vip-active-tab", "private");

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("tab", "private");
      nextUrl.searchParams.delete("from");
      window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
    };

    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
  }, []);

  useEffect(() => {
    const closeEmojiPanels = (event) => {
      if (showGroupEmoji && groupEmojiRef.current && !groupEmojiRef.current.contains(event.target)) {
        setShowGroupEmoji(false);
      }
      if (showPrivateEmoji && privateEmojiRef.current && !privateEmojiRef.current.contains(event.target)) {
        setShowPrivateEmoji(false);
      }
    };

    document.addEventListener("mousedown", closeEmojiPanels);
    document.addEventListener("touchstart", closeEmojiPanels);

    return () => {
      document.removeEventListener("mousedown", closeEmojiPanels);
      document.removeEventListener("touchstart", closeEmojiPanels);
    };
  }, [showGroupEmoji, showPrivateEmoji]);

  useEffect(() => {
    const timer = setInterval(() => {
      setChatClockTick((value) => value + 1);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  function isGroupChatOperatingTime() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    const totalMinutes = hour * 60 + minute;

    return totalMinutes >= 11 * 60 && totalMinutes < 18 * 60 + 30;
  }

  void chatClockTick;
  const groupChatOperating = isGroupChatOperatingTime();
  const memberGroupChatLocked =
    profile?.role !== "admin" && (chatFrozen || !groupChatOperating);

  useEffect(() => {
    if (!user || !profile || profile.role === "admin") return;

    const checkApproval = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", user.id)
        .single();

      if (data && data.approval_status !== "approved") {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setNotice("관리자에 의해 그룹방 이용 승인이 해제되었습니다.");
      }
    };

    const timer = setInterval(checkApproval, 10000);
    return () => clearInterval(timer);
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) return;

    if (chatTab === "private") {
      openPrivateChat();
    }

    loadMemberNames();
    loadMemberAvatars();
    loadMessages();
    loadGroupChatState();

    if (profile.role === "admin") {
      loadAdminUnreadCounts();
    } else {
      loadMemberUnreadCount();
    }

    const channel = supabase
      .channel("vip-group-chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_messages",
          filter: `room_id=eq.${ROOM_ID}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setMessages((current) => current.filter((item) => item.id !== deletedId));
            } else {
              await loadMessages();
            }
            return;
          }

          const newMessage = payload.new;
          if (!newMessage || newMessage.is_deleted) {
            await loadMessages();
            return;
          }

          setMessages((current) => {
            if (current.some((item) => item.id === newMessage.id)) {
              return current;
            }
            return [...current, newMessage];
          });

          await loadOneMemberName(newMessage.member_id, newMessage.ai_character_id);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "room_chat_settings", filter: `room_id=eq.${ROOM_ID}` },
        (payload) => setChatFrozen(Boolean(payload.new?.is_frozen))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;

    const privateMessageChannel = supabase
      .channel(`private-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_messages",
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setPrivateMessages((current) => current.filter((item) => item.id !== deletedId));
            } else if (privateChatId) {
              await loadPrivateMessages(privateChatId);
            }
            return;
          }

          if (profile?.role === "admin") {
            await loadAdminUnreadCounts();
          } else {
            await loadMemberUnreadCount();
          }

          if (payload.eventType === "INSERT" && payload.new?.sender_id !== user.id) {
            await loadOneMemberName(payload.new.sender_id);
            showPrivateIncomingAlert(payload.new);
          }

          if (privateChatId && payload.new?.chat_id === privateChatId) {
            if (payload.eventType === "INSERT") {
              setPrivateMessages((current) =>
                current.some((item) => item.id === payload.new.id) ? current : [...current, payload.new]
              );
            } else {
              await loadPrivateMessages(privateChatId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateMessageChannel);
    };
  }, [user, profile?.role, privateChatId]);

  useEffect(() => {
    if (chatTab !== "group") return;

    const jumpToLatest = () => {
      const box = groupMessagesRef.current;
      if (box) {
        box.style.scrollBehavior = "auto";
        box.scrollTop = box.scrollHeight + 10000;
      }
      groupBottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    };

    jumpToLatest();
    const raf1 = requestAnimationFrame(jumpToLatest);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(jumpToLatest));
    const timers = [50, 150, 350, 700, 1200].map((ms) => setTimeout(jumpToLatest, ms));

    const observer = typeof ResizeObserver !== "undefined" && groupMessagesRef.current
      ? new ResizeObserver(jumpToLatest)
      : null;
    if (observer && groupMessagesRef.current) observer.observe(groupMessagesRef.current);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
      observer?.disconnect();
    };
  }, [messages, chatTab]);

  useEffect(() => {
    if (chatTab !== "private") return;

    const jumpToLatest = () => {
      const box = privateMessagesRef.current;
      if (box) {
        box.style.scrollBehavior = "auto";
        box.scrollTop = box.scrollHeight + 10000;
      }
      privateBottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    };

    jumpToLatest();
    const raf1 = requestAnimationFrame(jumpToLatest);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(jumpToLatest));
    const timers = [50, 150, 350, 700, 1200].map((ms) => setTimeout(jumpToLatest, ms));

    const observer = typeof ResizeObserver !== "undefined" && privateMessagesRef.current
      ? new ResizeObserver(jumpToLatest)
      : null;
    if (observer && privateMessagesRef.current) observer.observe(privateMessagesRef.current);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
      observer?.disconnect();
    };
  }, [privateMessages, chatTab, privateChatId]);

  useEffect(() => {
    if (!user || !profile) return;

    loadAutoEvents();

    const timer = setInterval(() => {
      loadAutoEvents();
      loadMemberNames();
    }, 30000);

    return () => clearInterval(timer);
  }, [user, profile]);

  async function loadAutoEvents() {
    const { data, error } = await supabase.rpc("get_auto_events");

    if (error) {
      console.error("이벤트 불러오기 오류:", error);
      setNotice("이벤트 정보를 불러오지 못했습니다.");
      return;
    }

    setAutoEvents(data || []);
  }

  function setEventAnswer(eventId, value) {
    setEventAnswers((current) => ({ ...current, [eventId]: value }));
  }

  async function joinAutoEvent(eventItem, directAnswer = undefined) {
    if (!eventItem?.event_id || eventWorkingId) return;

    let answer = directAnswer;
    if (answer === undefined) answer = eventAnswers[eventItem.event_id] ?? null;

    if (eventItem.event_type === "number") {
      const n = Number(answer);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        setNotice("숫자 맞히기는 1부터 100까지 숫자 하나를 선택해주세요.");
        return;
      }
      answer = String(n);
    }

    if (eventItem.event_type === "quiz" && !["1", "2", "3", "4"].includes(String(answer))) {
      setNotice("퀴즈 보기 중 하나를 먼저 선택해주세요.");
      return;
    }

    if (eventItem.event_type === "gift_box" && !["1", "2", "3", "4"].includes(String(answer))) {
      setNotice("선물상자 1~4번 중 하나를 선택해주세요.");
      return;
    }

    if (eventItem.event_type === "roulette") {
      setRouletteSpins((current) => ({ ...current, [eventItem.event_id]: true }));
      await new Promise((resolve) => setTimeout(resolve, 900));
      answer = "roulette";
    }

    setEventWorkingId(eventItem.event_id);
    setNotice("");

    const { data, error } = await supabase.rpc("join_auto_event", {
      target_event_id: eventItem.event_id,
      submitted_answer: answer,
    });

    if (error) {
      setNotice(`이벤트 참여 실패: ${error.message}`);
      setEventSuccess(null);
    } else {
      const successMessage = `${eventItem.title || "이벤트"} 참여가 완료되었습니다.`;
      setNotice("");
      setEventSuccess({
        eventId: eventItem.event_id,
        title: eventItem.title || "이벤트",
        message: successMessage,
      });

      // 서버 상태를 즉시 다시 받아 버튼/배지도 "참여완료"로 바꿉니다.
      await loadAutoEvents();

      window.setTimeout(() => {
        setEventSuccess((current) =>
          current?.eventId === eventItem.event_id ? null : current
        );
      }, 3600);
    }

    setEventWorkingId(null);
    if (eventItem.event_type === "roulette") {
      setRouletteSpins((current) => ({ ...current, [eventItem.event_id]: false }));
    }
  }

  function eventGuide(type) {
    const guides = {
      gift_box: "4개의 상자 중 하나를 선택하세요. 당첨 상자를 고른 회원이 여러 명이면 그중 1명을 무작위로 선정합니다.",
      number: "1~100 중 숫자 하나를 선택하세요. 정답자가 여러 명이면 무작위 1명, 정답자가 없으면 가장 가까운 숫자의 회원 중 1명을 선정합니다.",
      roulette: "룰렛 돌리기를 눌러 응모하세요. 화면 회전은 연출이며, 회차 종료 후 실제 참여자 중 서버가 무작위로 1명을 선정합니다.",
      first_come: "시작 후 참여 버튼을 가장 먼저 정상 접수한 1명이 즉시 당첨됩니다. 회원 기기 시간이 아닌 서버 접수 순서로 판정합니다.",
      quiz: "문제를 읽고 보기 하나를 선택해 제출하세요. 정답자만 당첨 대상이며, 정답자가 여러 명이면 그중 1명을 무작위로 선정합니다.",
      draw: "응모하기를 한 번 누르면 완료됩니다. 회차 종료 후 실제 응모자 전체 중 서버가 무작위로 1명을 선정합니다.",
      attendance: "출석하기를 눌러 기록을 남기세요. 중복 참여는 차단되며, 해당 회차 출석자 중 1명을 무작위로 선정합니다.",
    };
    return guides[type] || "회차당 1회 참여할 수 있습니다.";
  }

  function renderEventGame(item, active, participated) {
    const busy = eventWorkingId === item.event_id;
    if (!active || participated) return null;

    if (item.event_type === "gift_box") {
      return (
        <div style={styles.gameArea}>
          <div style={styles.gameLabel}>선물상자를 선택하세요</div>
          <div style={styles.gameFourGrid}>
            {[1,2,3,4].map((box) => (
              <button key={box} type="button" onClick={() => setEventAnswer(item.event_id, String(box))}
                style={{...styles.gameChoice, ...(String(eventAnswers[item.event_id]) === String(box) ? styles.gameChoiceSelected : {})}}>
                🎁 <span>{box}번</span>
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => joinAutoEvent(item)} style={styles.gameSubmit}>
            {busy ? "처리 중..." : "선택한 상자로 참여하기"}
          </button>
        </div>
      );
    }

    if (item.event_type === "number") {
      return (
        <div style={styles.gameArea}>
          <div style={styles.gameLabel}>1 ~ 100 중 숫자 하나</div>
          <div style={styles.numberRow}>
            <input type="number" min="1" max="100" inputMode="numeric" value={eventAnswers[item.event_id] || ""}
              onChange={(e) => setEventAnswer(item.event_id, e.target.value)} placeholder="예: 27" style={styles.gameInput} />
            <button type="button" disabled={busy} onClick={() => joinAutoEvent(item)} style={styles.gameSubmitSmall}>
              {busy ? "처리 중" : "제출"}
            </button>
          </div>
        </div>
      );
    }

    if (item.event_type === "quiz") {
      const options = [item.quiz_option_1, item.quiz_option_2, item.quiz_option_3, item.quiz_option_4];
      return (
        <div style={styles.gameArea}>
          <div style={styles.quizQuestion}>Q. {item.quiz_question || "퀴즈를 불러오는 중입니다."}</div>
          <div style={styles.quizGrid}>
            {options.map((option, index) => (
              <button key={index} type="button" disabled={!option} onClick={() => setEventAnswer(item.event_id, String(index + 1))}
                style={{...styles.quizChoice, ...(String(eventAnswers[item.event_id]) === String(index + 1) ? styles.gameChoiceSelected : {})}}>
                <b>{index + 1}</b> {option || "-"}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => joinAutoEvent(item)} style={styles.gameSubmit}>
            {busy ? "제출 중..." : "정답 제출하기"}
          </button>
        </div>
      );
    }

    if (item.event_type === "roulette") {
      const spinning = rouletteSpins[item.event_id];
      return (
        <div style={styles.gameArea}>
          <div style={{...styles.rouletteWheel, transform: spinning ? "rotate(1080deg)" : "rotate(0deg)"}}>✦</div>
          <button type="button" disabled={busy || spinning} onClick={() => joinAutoEvent(item, "roulette")} style={styles.gameSubmit}>
            {spinning ? "룰렛 회전 중..." : busy ? "처리 중..." : "룰렛 돌리고 응모하기"}
          </button>
        </div>
      );
    }

    const labels = { first_come: "⚡ 지금 참여하기", draw: "🎟️ 응모하기", attendance: "📅 출석하기" };
    return (
      <div style={styles.gameArea}>
        <button type="button" disabled={busy} onClick={() => joinAutoEvent(item, null)} style={styles.gameSubmit}>
          {busy ? "처리 중..." : labels[item.event_type] || "참여하기"}
        </button>
      </div>
    );
  }

  function formatEventTime(value) {
    if (!value) return "--:--";

    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function eventIcon(type) {
    return (
      {
        gift_box: "🎁",
        number: "🎯",
        roulette: "🎰",
        first_come: "⚡",
        quiz: "🧩",
        draw: "🎟️",
        attendance: "📅",
      }[type] || "🎁"
    );
  }

  function getGroupEventBanner() {
    if (!autoEvents || autoEvents.length === 0) return null;

    const activeEvent = autoEvents.find(
      (item) => item.status === "active"
    );

    if (activeEvent) {
      return {
        type: "active",
        icon: eventIcon(activeEvent.event_type),
        title: `지금 ${activeEvent.title.replace(/^[^\s]+\s/, "")} 이벤트 진행 중!`,
        text: `${formatEventTime(activeEvent.starts_at)} ~ ${formatEventTime(
          activeEvent.ends_at
        )} 참여 가능 · 이벤트 칸으로 이동해서 참여해주세요`,
      };
    }

    const nextEvent = autoEvents.find(
      (item) => item.status === "scheduled"
    );

    if (nextEvent) {
      return {
        type: "next",
        icon: eventIcon(nextEvent.event_type),
        title: `다음 이벤트 · ${nextEvent.title.replace(/^[^\s]+\s/, "")}`,
        text: `${formatEventTime(nextEvent.starts_at)} ~ ${formatEventTime(
          nextEvent.ends_at
        )} 참여 가능 · 곧 시작됩니다`,
      };
    }

    return {
      type: "done",
      icon: "🎉",
      title: "오늘의 이벤트가 종료되었습니다",
      text: "다음 이벤트는 오전 11시부터 시작됩니다.",
    };
  }

  function getSortedAutoEvents() {
    const statusOrder = { active: 0, scheduled: 1, completed: 2 };

    return [...autoEvents].sort((a, b) => {
      const aOrder = statusOrder[a.status] ?? 3;
      const bOrder = statusOrder[b.status] ?? 3;

      if (aOrder !== bOrder) return aOrder - bOrder;

      return Number(a.round_number || 0) - Number(b.round_number || 0);
    });
  }

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      const fromPush = params.get("from") === "push";
      const savedTab = window.sessionStorage.getItem("vip-active-tab");

      if (["home", "admin", "members", "group", "event", "ai", "private"].includes(urlTab)) {
        setChatTab(urlTab);
        window.sessionStorage.setItem("vip-active-tab", urlTab);
      } else if (["home", "admin", "members", "group", "event", "ai", "private"].includes(savedTab)) {
        setChatTab(savedTab);
      } else {
        setChatTab("home");
      }

      // 푸시 알림을 눌러 들어온 경우 인증 세션이 살아 있으면 잠금 화면을 건너뜁니다.
      if (fromPush) {
        window.localStorage.removeItem("vip-ui-locked");
        setVipLocked(false);
        window.history.replaceState({}, "", "/?tab=private");
      } else {
        setVipLocked(window.localStorage.getItem("vip-ui-locked") === "1");
      }
    }

    await loadProfile(session.user);
  }

  async function loadProfile(authUser) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error || !data) {
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (data.approval_status !== "approved") {
      await supabase.auth.signOut();
      setNotice("관리자 승인 대기 중인 계정입니다.");
      setLoading(false);
      return;
    }

    setUser(authUser);
    setProfile(data);

    if (data.role === "admin" && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      const savedTab = window.sessionStorage.getItem("vip-active-tab");
      if (!urlTab && !savedTab) {
        setChatTab("admin");
        window.sessionStorage.setItem("vip-active-tab", "admin");
      }
    }

    setLoading(false);
  }

  async function loadMemberNames() {
    const { data: members, error } = await supabase
      .from("members")
      .select("id,nickname,status,role");

    if (error) return;

    const map = {};
    let approvedCount = 0;

    (members || []).forEach((member) => {
      map[member.id] = member.nickname;
      if (member.status === "approved" && member.role !== "admin") approvedCount += 1;
      if (member.role === "admin") {
        setAdminIdentity((current) => ({
          ...current,
          nickname: member.nickname || "관리자",
        }));
      }
    });

    setMemberNames(map);
    // V17: AI 캐릭터/가라계정도 실제 members 계정이므로 별도 숫자를 더하지 않습니다.
    setApprovedMemberCount(approvedCount);
  }

  async function loadOneMemberName(memberId, aiCharacterId = null) {
    const targetId = aiCharacterId || memberId;
    if (!targetId) return;

    if (aiCharacterId) {
      const { data, error } = await supabase
        .from("ai_characters")
        .select("id,nickname")
        .eq("id", aiCharacterId)
        .single();

      if (error || !data) return;
      setMemberNames((current) => ({ ...current, [data.id]: data.nickname }));
      return;
    }

    const { data, error } = await supabase
      .from("members")
      .select("id,nickname")
      .eq("id", memberId)
      .single();

    if (error || !data) return;

    setMemberNames((current) => ({
      ...current,
      [data.id]: data.nickname,
    }));
  }

  async function loadMemberAvatars() {
    const { data, error } = await supabase.rpc("get_chat_avatars");
    if (error || !data) return;

    const map = {};
    data.forEach((member) => {
      map[member.id] = member.avatar || "profile-01";
    });
    setMemberAvatars(map);
  }

  async function saveAvatar(avatar) {
    if (!user) return;

    setWorking(true);

    const { error } = await supabase.rpc("set_my_avatar", {
      new_avatar: avatar,
    });

    if (error) {
      setNotice(`프로필 변경 실패: ${error.message}`);
      setWorking(false);
      return;
    }

    setProfile((current) => ({
      ...current,
      avatar,
    }));

    setMemberAvatars((current) => ({
      ...current,
      [user.id]: avatar,
    }));

    setShowAvatarPicker(false);
    setNotice("프로필 이미지가 변경되었습니다.");
    setWorking(false);
  }

  async function loadGroupChatState() {
    const { data, error } = await supabase.rpc("get_group_chat_state", {
      target_room_id: ROOM_ID,
    });
    if (!error) setChatFrozen(Boolean(data));
  }

  async function toggleGroupChatFreeze() {
    if (profile?.role !== "admin" || freezeWorking) return;
    setFreezeWorking(true);
    const nextValue = !chatFrozen;
    const { error } = await supabase.rpc("set_group_chat_frozen", {
      target_room_id: ROOM_ID,
      frozen: nextValue,
    });
    if (error) {
      setNotice(`채팅 상태 변경 실패: ${error.message}`);
    } else {
      setChatFrozen(nextValue);
      setNotice(nextValue ? "그룹채팅을 얼렸습니다." : "그룹채팅을 다시 열었습니다.");
    }
    setFreezeWorking(false);
  }


  const CHAT_EMOJIS = [
    "😀","😄","😁","😂","🤣","😊","😍","🥰","😘","😎","🤩","🥳",
    "😭","🥹","😢","😅","🤔","🙌","👏","👍","❤️","💛","💙","💜",
    "✨","🎉","🎁","🏆","🔥","💯","🍀","⭐","🌟","🙏","👌","💎"
  ];

  function formatChatTime(value) {
    if (!value) return "";

    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  }

  function chatDateKey(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  function formatChatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  }

  function renderMessageContent(content) {
    if (!content) return null;

    if (content.startsWith("[[IMAGE]]")) {
      const url = content.slice(9);
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt="전송 이미지"
            style={{
              display: "block",
              width: "min(180px, 48vw)",
              maxHeight: "220px",
              objectFit: "cover",
              borderRadius: "12px",
            }}
          />
        </a>
      );
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, index) =>
      /^https?:\/\//.test(part) ? (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#9b692d",
            textDecoration: "underline",
            overflowWrap: "anywhere",
          }}
        >
          {part}
        </a>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  }

  async function uploadChatImage(file, scope) {
    if (!file || !user || mediaUploading) return;

    if (!file.type.startsWith("image/")) {
      setNotice("사진 또는 GIF 이미지만 전송할 수 있습니다.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setNotice("이미지는 8MB 이하만 전송할 수 있습니다.");
      return;
    }

    setMediaUploading(true);
    setNotice("");

    try {
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("chat-media")
        .getPublicUrl(path);

      const content = `[[IMAGE]]${publicData.publicUrl}`;

      if (scope === "group") {
        const { error } = await supabase.from("group_messages").insert({
          room_id: ROOM_ID,
          member_id: user.id,
          message_type: "text",
          content,
          is_deleted: false,
        });
        if (error) throw error;
        await loadMessages();
      } else {
        if (!privateChatId) throw new Error("1:1 상담방을 찾을 수 없습니다.");
        const { error } = await supabase.from("private_messages").insert({
          chat_id: privateChatId,
          sender_id: user.id,
          message_type: "text",
          content,
          is_deleted: false,
          is_read: false,
        });
        if (error) throw error;
        await sendPrivatePush(privateChatId, content);
        await loadPrivateMessages(privateChatId);
      }
    } catch (error) {
      setNotice(`사진 전송 실패: ${error.message}`);
    } finally {
      setMediaUploading(false);
    }
  }

  async function adminDeleteGroupMessage(messageId) {
    if (profile?.role !== "admin") return;
    if (!window.confirm("이 메시지를 모든 회원에게서 완전히 삭제할까요?")) return;

    const previousMessages = messages;
    setMessages((current) => current.filter((item) => item.id !== messageId));

    const { error } = await supabase.rpc("admin_delete_group_message", {
      target_message_id: messageId,
    });

    if (error) {
      setMessages(previousMessages);
      setNotice(`메시지 삭제 실패: ${error.message}`);
      return;
    }
  }

  async function adminDeletePrivateMessage(messageId) {
    if (profile?.role !== "admin") return;
    if (!window.confirm("이 1:1 메시지를 완전히 삭제할까요?")) return;

    const previousMessages = privateMessages;
    setPrivateMessages((current) => current.filter((item) => item.id !== messageId));

    const { error } = await supabase.rpc("admin_delete_private_message", {
      target_message_id: messageId,
    });

    if (error) {
      setPrivateMessages(previousMessages);
      setNotice(`메시지 삭제 실패: ${error.message}`);
      return;
    }
  }

  async function adminKickMember(memberId, memberNickname) {
    if (profile?.role !== "admin" || !memberId || memberId === user?.id) return;
    if (!window.confirm(`${memberNickname} 님을 그룹방에서 퇴장시키고 승인을 해제할까요?`)) return;

    const { error } = await supabase.rpc("admin_kick_member", {
      target_member_id: memberId,
    });

    if (error) {
      setNotice(`회원 퇴장 실패: ${error.message}`);
      return;
    }

    setNotice(`${memberNickname} 님을 퇴장 처리했습니다.`);
    await loadMemberNames();
    await loadMessages();
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("group_messages")
      .select("*")
      .eq("room_id", ROOM_ID)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data);
    }
  }

  async function openPrivateChat() {
    setNotice("");

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("vip-active-tab", "private");
    }

    if (profile?.role === "admin") {
      setChatTab("private");
      await loadAdminChats();
      await loadAdminMembers();
      await loadAdminUnreadCounts();
      return;
    }

    const { data: chatId, error } = await supabase.rpc(
      "get_or_create_admin_chat"
    );

    if (error) {
      console.error("1:1 상담방 열기 오류:", error);
      setNotice("1:1 상담방을 불러오지 못했습니다.");
      return;
    }

    setPrivateChatId(chatId);
    setChatTab("private");

    await supabase.rpc("mark_private_chat_read", {
      target_chat_id: chatId,
    });

    await loadPrivateMessages(chatId);
    await loadMemberUnreadCount();
  }

  async function loadPrivateMessages(chatId) {
    if (!chatId) return;

    const { data, error } = await supabase
      .from("private_messages")
      .select("*")
      .eq("chat_id", chatId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error(
        "1:1 메시지 불러오기 오류:",
        error
      );
      return;
    }

    setPrivateMessages(data || []);

    const otherSenderIds = Array.from(new Set(
      (data || [])
        .map((item) => item.sender_id)
        .filter((senderId) => senderId && senderId !== user?.id)
    ));

    for (const senderId of otherSenderIds) {
      await loadOneMemberName(senderId);
    }
  }

  async function loadAdminChats() {
    if (!user || profile?.role !== "admin") return;

    const { data, error } = await supabase.rpc(
      "get_admin_private_chats"
    );

    if (error) {
      console.error(
        "관리자 상담 목록 불러오기 오류:",
        error
      );
      setNotice("상담 목록을 불러오지 못했습니다.");
      return;
    }

    const result = (data || []).map((chat) => ({
      id: chat.chat_id,
      member_id: chat.member_id,
      status: chat.status,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
      member: {
        id: chat.member_id,
        nickname: chat.nickname,
        avatar: chat.avatar || "profile-01",
      },
    }));

    setAdminChats(
      result.sort(
        (a, b) =>
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
      )
    );
  }

  async function loadAdminMembers() {
    if (!user || profile?.role !== "admin") return;

    const { data, error } = await supabase.rpc(
      "get_admin_member_list"
    );

    if (error) {
      console.error(
        "관리자 회원 목록 불러오기 실패:",
        error
      );
      return;
    }

    setAdminMembers(data || []);
  }

  async function loadAdminAllMembers() {
    if (!user || profile?.role !== "admin") return;

    const { data, error } = await supabase.rpc("get_admin_all_profiles");
    if (error) {
      console.error("전체 회원 목록 불러오기 실패:", error);
      setAdminAllMembers([]);
      setAdminMemberLoadError(error.message || "회원 목록을 불러오지 못했습니다.");
      return;
    }
    setAdminMemberLoadError("");
    setAdminAllMembers(data || []);
  }

  async function setMemberApproval(memberId, nextStatus) {
    if (!user || profile?.role !== "admin" || !memberId) return;
    setWorking(true);
    setNotice("");
    try {
      const { error } = await supabase.rpc("admin_set_profile_approval", {
        target_member_id: memberId,
        target_status: nextStatus,
      });
      if (error) {
        setNotice(`회원 처리 실패: ${error.message}`);
        return;
      }
      await Promise.all([loadAdminAllMembers(), loadAdminMembers(), loadMemberNames()]);
      setNotice(nextStatus === "approved" ? "회원 승인이 완료되었습니다." : "가입 신청을 거절했습니다.");
    } finally {
      setWorking(false);
    }
  }

  async function syncAiCharacterAccounts() {
    if (!user || profile?.role !== "admin" || aiAccountsWorking) return;
    setAiAccountsWorking(true);
    setNotice("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("관리자 로그인 정보를 찾을 수 없습니다.");

      const response = await fetch("/api/admin/ai-accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!response.ok || !result) {
        throw new Error(result?.error || "AI 캐릭터 계정 생성에 실패했습니다.");
      }

      await Promise.all([
        loadAdminAllMembers(),
        loadAdminMembers(),
        loadMemberNames(),
        loadMemberAvatars(),
        loadAiProcessState(),
      ]);

      if (result.failed?.length) {
        setNotice(`AI 계정 ${result.createdOrSynced}/${result.total}명 적용 · 실패 ${result.failed.length}명`);
      } else {
        setNotice(`AI 캐릭터 ${result.createdOrSynced}명 실제 회원계정 생성/동기화 완료`);
      }
    } catch (error) {
      setNotice(`AI 캐릭터 계정 생성 실패: ${error.message || "오류"}`);
    } finally {
      setAiAccountsWorking(false);
    }
  }

  async function changeMemberAccountType(member, nextType) {
    if (!user || profile?.role !== "admin" || !member?.member_id) return;
    const label = nextType === "ai_character"
      ? "AI 캐릭터"
      : nextType === "managed"
        ? "가라계정"
        : "일반회원";

    const { error } = await supabase.rpc("admin_set_account_type", {
      target_member_id: member.member_id,
      target_account_type: nextType,
      target_ai_chat_enabled: nextType === "ai_character",
    });

    if (error) {
      setNotice(`계정 종류 변경 실패: ${error.message}`);
      return;
    }

    setNotice(`${member.nickname} 계정을 '${label}'으로 변경했습니다.`);
    await Promise.all([loadAdminAllMembers(), loadAdminMembers(), loadMemberNames()]);
  }

  function accountTypeLabel(value) {
    if (value === "ai_character") return "AI 캐릭터";
    if (value === "managed") return "가라계정";
    return "일반회원";
  }

  function adminAccountBadge(memberId) {
    if (profile?.role !== "admin" || !memberId) return null;
    const member = adminAllMembers.find((item) => item.member_id === memberId);
    if (!member || member.account_type === "human") return null;
    const isAi = member.account_type === "ai_character";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginLeft: "6px",
          padding: "2px 6px",
          borderRadius: "999px",
          fontSize: "10px",
          fontWeight: 800,
          color: isAi ? "#315e9b" : "#8a5a22",
          background: isAi ? "#eaf3ff" : "#fff2dc",
          border: `1px solid ${isAi ? "#c8ddfb" : "#efd2a4"}`,
          verticalAlign: "middle",
        }}
      >
        {isAi ? "AI" : "가라"}
      </span>
    );
  }

  async function openAdminMemberChat(member) {
    if (!user || profile?.role !== "admin") return;

    setNotice("");

    const { data: chatId, error } = await supabase.rpc(
      "admin_get_or_create_private_chat",
      {
        target_member_id: member.member_id,
      }
    );

    if (error) {
      console.error(
        "회원 1:1 상담방 열기 오류:",
        error
      );
      setNotice("1:1 상담방을 열지 못했습니다.");
      return;
    }

    const chat = {
      id: chatId,
      member_id: member.member_id,
      member: {
        id: member.member_id,
        nickname: member.nickname,
        avatar: member.avatar || "profile-01",
      },
    };

    setMemberSearch("");
    setChatTab("private");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("vip-active-tab", "private");
    }
    await loadAdminChats();
    await selectAdminChat(chat);
  }

  async function loadAdminUnreadCounts() {
    if (!user || profile?.role !== "admin") return;

    const { data, error } = await supabase.rpc(
      "get_admin_private_unread_counts"
    );

    if (error) {
      console.error(
        "안 읽은 메시지 수 불러오기 오류:",
        error
      );
      return;
    }

    const counts = {};

    (data || []).forEach((item) => {
      counts[item.chat_id] = Number(
        item.unread_count || 0
      );
    });

    setAdminUnreadCounts(counts);
  }

  async function loadMemberUnreadCount() {
    if (!user || profile?.role === "admin") return;

    const { data, error } = await supabase.rpc(
      "get_my_private_unread_count"
    );

    if (error) {
      console.error(
        "회원 안 읽은 메시지 수 불러오기 오류:",
        error
      );
      return;
    }

    setMemberUnreadCount(Number(data || 0));
  }

  async function selectAdminChat(chat) {
    setSelectedAdminChat(chat);
    setPrivateChatId(chat.id);
    setPrivateMessages([]);

    await supabase.rpc("mark_private_chat_read", {
      target_chat_id: chat.id,
    });

    await loadPrivateMessages(chat.id);
    await loadAdminUnreadCounts();
  }

  async function sendPrivateMessage(e) {
    e.preventDefault();

    const text = privateMessage.trim();

    if (!text || !privateChatId || !user) return;

    const { error } = await supabase
      .from("private_messages")
      .insert({
        chat_id: privateChatId,
        sender_id: user.id,
        message_type: "text",
        content: text,
        is_deleted: false,
        is_read: false,
      });

    if (error) {
      console.error(
        "1:1 메시지 전송 오류:",
        error
      );
      setNotice("메시지를 보내지 못했습니다.");
      return;
    }

    setPrivateMessage("");
    await sendPrivatePush(privateChatId, text);
    await loadPrivateMessages(privateChatId);
  }

  async function handleSignup(e) {
    e.preventDefault();

    const cleanNickname = nickname.trim();
    const cleanRealName = realName.trim();

    if (!cleanNickname || !cleanRealName || !password) {
      setNotice(
        "닉네임, 성함, 비밀번호를 모두 입력해주세요."
      );
      return;
    }

    if (password.length < 6) {
      setNotice(
        "비밀번호는 6자리 이상 입력해주세요."
      );
      return;
    }

    setWorking(true);
    setNotice("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: cleanNickname,
          realName: cleanRealName,
          password: normalizePasswordInput(password),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNotice(
          result?.message || "가입 신청 중 오류가 발생했습니다."
        );
        return;
      }

      setNickname("");
      setRealName("");
      setPassword("");
      setMode("login");

      setNotice(
        "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."
      );
    } catch {
      setNotice(
        "가입 신청 중 오류가 발생했습니다."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    const cleanNickname = nickname.trim();

    if (!cleanNickname || !password) {
      setNotice(
        "닉네임과 비밀번호를 입력해주세요."
      );
      return;
    }

    setWorking(true);
    setNotice("");

    try {
      const normalizedPassword = normalizePasswordInput(password);
      const passwordCandidates = Array.from(new Set([
        password,
        normalizedPassword,
        normalizedPassword.toUpperCase(),
      ].filter(Boolean)));

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: cleanNickname,
          passwordCandidates,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.accessToken || !result?.refreshToken) {
        setNotice(
          result?.message || "닉네임 또는 비밀번호를 확인해주세요."
        );
        return;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      if (error || !data?.user) {
        setNotice(
          "닉네임 또는 비밀번호를 확인해주세요."
        );
        return;
      }

      const {
        data: memberProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError || !memberProfile) {
        await supabase.auth.signOut();
        setNotice(
          "회원 정보를 확인할 수 없습니다."
        );
        return;
      }

      if (
        memberProfile.approval_status !== "approved"
      ) {
        await supabase.auth.signOut();

        setNotice(
          "가입 신청이 접수되었습니다. 현재 관리자 승인 대기 중입니다."
        );
        return;
      }

      const landingTab = memberProfile.role === "admin" ? "admin" : "private";
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("vip-active-tab", landingTab);
      }
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
      setPassword("");
    } catch {
      setNotice("로그인 중 오류가 발생했습니다.");
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();

    const cleanMessage = message.trim();

    if (
      !cleanMessage ||
      !user ||
      !profile ||
      working
    )
      return;

    if (profile.role !== "admin" && (chatFrozen || !groupChatOperating)) {
      setMessage("");
      return;
    }

    setWorking(true);
    setNotice("");

    const { error } = await supabase
      .from("group_messages")
      .insert({
        room_id: ROOM_ID,
        member_id: user.id,
        message_type: "text",
        content: cleanMessage,
        is_deleted: false,
      });

    if (error) {
      setNotice(
        `메시지 전송 실패: ${error.message}`
      );
    } else {
      setMessage("");
      await loadMessages();

      try {
        const aiResponse = await fetch(
          "/api/ai-chat",
          {
            method: "POST",
          }
        );

        const aiResult = await aiResponse.json();

        if (
          !aiResponse.ok ||
          !aiResult.success
        ) {
          console.error(
            "AI 커뮤니티 오류:",
            aiResult.error
          );
        }
      } catch (aiError) {
        console.error(
          "AI 커뮤니티 호출 오류:",
          aiError
        );
      }
    }

    setWorking(false);
  }

  async function handleLogout() {
    // "로그아웃"은 VIP 화면만 잠그고 Supabase 인증 세션은 안전하게 유지합니다.
    // 비밀번호를 localStorage에 저장하지 않으면서 빠른 재접속과 푸시 딥링크를 지원합니다.
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vip-ui-locked", "1");
      window.localStorage.setItem("vip-last-nickname", profile?.nickname || "");
      window.localStorage.setItem("vip-last-avatar", profile?.avatar || "profile-01");
      window.sessionStorage.setItem("vip-active-tab", profile?.role === "admin" ? "admin" : "private");
    }
    setShowProfileInfo(false);
    setShowAvatarPicker(false);
    setPrivateAlert(null);
    setVipLocked(true);
  }

  function resumeVipSession() {
    const landingTab = profile?.role === "admin" ? "admin" : "private";
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("vip-ui-locked");
      window.sessionStorage.setItem("vip-active-tab", landingTab);
      window.history.replaceState({}, "", `/?tab=${landingTab}`);
    }
    setChatTab(landingTab);
    setVipLocked(false);
    setNotice("");
  }

  async function switchVipAccount() {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("vip-ui-locked");
      window.sessionStorage.removeItem("vip-active-tab");
      window.history.replaceState({}, "", "/");
    }
    setVipLocked(false);
    setUser(null);
    setProfile(null);
    setMessages([]);
    setPrivateMessages([]);
    setMemberNames({});
    setMessage("");
    setNickname("");
    setPassword("");
    setNotice("");
    setMode("login");
  }

  function getMessageNickname(item) {
    if (item.member_id === user?.id) {
      return profile?.nickname || "나";
    }

    const senderId = item.ai_character_id || item.member_id;
    return memberNames[senderId] || (item.ai_character_id ? "AI 캐릭터" : "VIP 회원");
  }


  function getActiveAutoEvent() {
    return (autoEvents || []).find((item) => item.status === "active") || null;
  }

  function getNextAutoEvent() {
    return (autoEvents || []).find((item) => item.status === "scheduled") || null;
  }

  function getAiRecentResults() {
    return (aiSim?.activity || []).filter((item) =>
      item.type === "result" || item.type === "hold" || item.type === "wait"
    );
  }

  function getAiMarketCounts() {
    const holdings = aiSim?.holdings || [];
    return {
      total: holdings.length,
      stock: holdings.filter((item) => item.type !== "crypto").length,
      crypto: holdings.filter((item) => item.type === "crypto").length,
    };
  }


  function eventHeroBackground(type) {
    const map = {
      gift_box: "radial-gradient(circle at 82% 22%,rgba(255,205,91,.42),transparent 22%),radial-gradient(circle at 18% 78%,rgba(185,40,45,.30),transparent 30%),linear-gradient(135deg,#5b2728,#2b2020 62%,#7a4d25)",
      number: "radial-gradient(circle at 80% 22%,rgba(77,160,255,.32),transparent 24%),radial-gradient(circle at 18% 78%,rgba(242,83,77,.30),transparent 28%),linear-gradient(135deg,#392d3b,#241f28 62%,#49322f)",
      roulette: "radial-gradient(circle at 82% 20%,rgba(255,93,87,.32),transparent 24%),radial-gradient(circle at 18% 78%,rgba(255,202,92,.28),transparent 28%),linear-gradient(135deg,#4b2927,#241f20 62%,#6a4327)",
      first_come: "radial-gradient(circle at 82% 22%,rgba(255,218,89,.34),transparent 24%),radial-gradient(circle at 18% 78%,rgba(255,130,57,.25),transparent 30%),linear-gradient(135deg,#4c3225,#231f1c 62%,#72502d)",
      quiz: "radial-gradient(circle at 82% 22%,rgba(104,213,143,.30),transparent 24%),radial-gradient(circle at 18% 78%,rgba(238,194,79,.26),transparent 30%),linear-gradient(135deg,#263a31,#202420 62%,#5a4828)",
      draw: "radial-gradient(circle at 82% 22%,rgba(238,105,162,.30),transparent 24%),radial-gradient(circle at 18% 78%,rgba(255,207,97,.26),transparent 30%),linear-gradient(135deg,#432a37,#241f24 62%,#60412d)",
      attendance: "radial-gradient(circle at 82% 22%,rgba(90,178,255,.30),transparent 24%),radial-gradient(circle at 18% 78%,rgba(255,207,97,.24),transparent 30%),linear-gradient(135deg,#273747,#202329 62%,#59432e)",
    };
    return map[type] || "radial-gradient(circle at 82% 22%,rgba(239,190,111,.30),transparent 24%),linear-gradient(135deg,#49332b,#241f1d 65%,#674729)";
  }

  if (loading) {
    return (
      <main style={styles.page}>VIP EVENT</main>
    );
  }

  if (user && profile && vipLocked) {
    const avatarKey = profile.avatar || "profile-01";
    return (
      <main style={styles.vipReturnPage}>
        <section style={styles.vipReturnCard}>
          <div style={styles.vipReturnGlowA}></div>
          <div style={styles.vipReturnGlowB}></div>
          <div style={styles.vipReturnCrown}>♛</div>
          <div style={styles.vipReturnEyebrow}>AI PROCESS · VIP PRIVATE</div>

          <div style={styles.vipReturnAvatarWrap}>
            <div style={styles.vipReturnAvatarHalo}></div>
            <img
              src={avatarSrc(avatarKey)}
              alt=""
              style={styles.vipReturnAvatar}
            />
            <span style={styles.vipReturnSeal}>VIP</span>
          </div>

          <h2 style={styles.vipReturnTitle}>
            <span>{profile.nickname}</span>님,
            <br />다시 오셨네요
          </h2>
          <p style={styles.vipReturnText}>
            회원님의 프라이빗 VIP 공간이 준비되어 있습니다.
            <br />간편하게 다시 접속하세요.
          </p>

          <button type="button" onClick={resumeVipSession} style={styles.vipReturnPrimary}>
            VIP 다시 접속 <span>›</span>
          </button>
          <button type="button" onClick={switchVipAccount} style={styles.vipReturnSecondary}>
            다른 계정으로 로그인
          </button>

          <div style={styles.vipReturnFoot}>
            <span>◆</span> PRIVATE ACCESS <span>◆</span>
          </div>
        </section>
      </main>
    );
  }

  if (user && profile) {
    const activeEvent = getActiveAutoEvent();
    const nextEvent = getNextAutoEvent();
    const featuredEvent = activeEvent || nextEvent;
    const unreadPrivate = profile?.role === "admin"
      ? Object.values(adminUnreadCounts).reduce((sum, count) => sum + Number(count || 0), 0)
      : Number(memberUnreadCount || 0);
    const adminPendingMembers = profile?.role === "admin"
      ? adminAllMembers.filter((member) => member.approval_status === "pending" && member.role !== "admin")
      : [];
    const adminApprovedMembers = profile?.role === "admin"
      ? adminAllMembers.filter((member) => member.approval_status === "approved" && member.role !== "admin")
      : [];
    const adminRejectedMembers = profile?.role === "admin"
      ? adminAllMembers.filter((member) => member.approval_status === "rejected" && member.role !== "admin")
      : [];
    const adminVisibleMembers = profile?.role === "admin"
      ? adminAllMembers.filter((member) => {
          if (member.role === "admin") return false;
          if (adminMemberFilter !== "all" && member.approval_status !== adminMemberFilter) return false;
          const query = memberSearch.trim().toLowerCase();
          if (!query) return true;
          return `${member.nickname || ""} ${member.real_name || ""}`.toLowerCase().includes(query);
        })
      : [];

    const aiMarketRows = Array.isArray(aiSim?.marketRows) ? aiSim.marketRows : [];
    const aiRecentResults = Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory.slice(0, 14) : [];
    const aiCurrentStartMoney = aiStartMoney();
    const aiChart = buildAiChartModel(aiSession?.status === "running" ? (aiSim?.history || []) : [], aiCurrentStartMoney);
    const aiLastResult = aiRecentResults[0] || null;
    const aiPositiveMarkets = aiMarketRows.filter((item) => Number(item.changePct) > 0).length;
    const aiNegativeMarkets = aiMarketRows.filter((item) => Number(item.changePct) < 0).length;
    const aiCompletedCount = ["completed", "stopped"].includes(aiSession?.status) ? 1 : 0;
    const aiTodayLabel = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    const aiTodayProfit = (Array.isArray(aiSim?.resultHistory) ? aiSim.resultHistory : []).reduce((sum, item) => {
      if (!item?.at) return sum;
      const itemLabel = new Date(item.at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
      return itemLabel === aiTodayLabel ? sum + Number(item.intervalProfit || 0) : sum;
    }, 0);
    const aiProgressPct = aiSession?.status === "running" && aiSession?.ends_at
      ? Math.max(4, Math.min(100, ((Date.now() - new Date(aiSession.started_at).getTime()) / (Math.max(1, Number(aiSession.duration_hours)) * 3600000)) * 100))
      : 0;

    const navItems = profile?.role === "admin"
      ? [
          { id: "admin", icon: "▦", label: "대시보드" },
          { id: "members", icon: "♙", label: "회원 관리" },
          { id: "ai", icon: "bars", label: "AI PROCESS" },
          { id: "event", icon: "🎁", label: "이벤트" },
          { id: "group", icon: "💬", label: "그룹채팅" },
          { id: "private", icon: "🎧", label: "1:1 문의" },
        ]
      : [
          { id: "home", icon: "⌂", label: "홈" },
          { id: "ai", icon: "bars", label: "AI PROCESS" },
          { id: "event", icon: "🎁", label: "이벤트" },
          { id: "group", icon: "💬", label: "그룹채팅" },
          { id: "private", icon: "🎧", label: "1:1 문의" },
        ];

    const changeTab = async (id) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("vip-active-tab", id);
      }

      if (id === "private") {
        await openPrivateChat();
        return;
      }

      setChatTab(id);
    };

    return (
      <main style={styles.refPage} className="vip-page-shell">
        <section
          style={{...styles.refApp,...(chatTab === "ai" || chatTab === "admin" ? styles.refAppAi : {})}}
          className={`vip-app-shell ${profile?.role === "admin" ? "is-admin" : "is-member"} ${chatTab === "ai" ? "is-ai" : ""}`}
        >
          {showWelcomeModal && profile?.role !== "admin" && (
            <div className="vip-welcome-backdrop">
              <section className="vip-welcome-card">
                <button type="button" className="vip-welcome-close" onClick={() => setShowWelcomeModal(false)}>×</button>
                <div className="vip-welcome-medal"><span>VIP</span></div>
                <div className="vip-welcome-eyebrow">AI PROCESS · VIP MEMBERSHIP</div>
                <h2>VIP 라운지에 오신 것을<br/>환영합니다.</h2>
                <p className="vip-welcome-lead">AI PROCESS VIP 회원만을 위한 그룹 라운지, 이벤트, AI 프로세스와 1:1 전용 지원을 이용하실 수 있습니다.</p>
                <div className="vip-welcome-benefit">
                  <div className="vip-welcome-benefit-icon">♛</div>
                  <div><b>VIP MEMBER BENEFIT</b><span>다양한 이벤트 · 특별 혜택 · 전용 서비스를 자유롭게 이용하세요.</span></div>
                </div>
                <button type="button" className="vip-welcome-alert" onClick={enablePrivateNotifications}>
                  <span>🔔</span><div><b>알림 설정을 권장합니다</b><small>이벤트 당첨 및 VIP 주요 안내를 놓치지 않도록 알림을 켜주세요.</small></div>
                </button>
                <div className="vip-welcome-links">
                  <button type="button" onClick={() => { setShowWelcomeModal(false); setChatTab("group"); }}>💬 <b>그룹채팅 바로가기</b></button>
                  <button type="button" onClick={() => { setShowWelcomeModal(false); setChatTab("event"); }}>🎁 <b>이벤트 확인하기</b></button>
                </div>
                <button type="button" className="vip-welcome-confirm" onClick={async () => {
                  setShowWelcomeModal(false);
                  if (typeof window !== "undefined" && user?.id) {
                    window.localStorage.setItem(`vip-welcome-seen-${user.id}`, "1");
                  }
                  await changeTab("private");
                }}>확인했어요 <span>›</span></button>
              </section>
            </div>
          )}
          {privateAlert && chatTab !== "private" && (
            <button
              type="button"
              onClick={() => {
                setPrivateAlert(null);
                setChatTab("private");
                window.sessionStorage.setItem("vip-active-tab", "private");
                openPrivateChat();
              }}
              style={styles.refPrivateAlert}
            >
              <img src="/avatars/40/profile-01.jpg" alt="" style={styles.refPrivateAlertAvatar} />
              <span style={styles.refPrivateAlertCopy}>
                <b>{privateAlert.title}</b>
                <small>{privateAlert.body}</small>
              </span>
              <span style={styles.refPrivateAlertNow}>지금</span>
            </button>
          )}
          <header style={styles.refHeader} className="vip-app-header">
            <div style={styles.refBrand}>
              <div>
                <div style={styles.refBrandTitle} className="vip-brand-title">AI PROCESS <span>VIP</span></div>
                <div style={styles.refBrandSub} className="vip-brand-sub">
                  {profile?.role === "admin"
                    ? (chatTab === "admin" ? "ADMIN CONSOLE" : chatTab === "members" ? "ADMIN · MEMBERS" : chatTab === "group" ? "ADMIN · GROUP" : chatTab === "event" ? "ADMIN · EVENT" : chatTab === "ai" ? "ADMIN · AI PROCESS" : "ADMIN · MEMBER SUPPORT")
                    : (chatTab === "home" ? "VIP DASHBOARD" : chatTab === "group" ? "Private Community" : chatTab === "event" ? "Event Schedule" : chatTab === "ai" ? "AI Market Process" : "Private Support")}
                </div>
              </div>
            </div>
            <div style={styles.refHeaderRight}>
              <button
                type="button"
                onClick={enablePrivateNotifications}
                style={{
                  height: "42px",
                  minWidth: "72px",
                  padding: "0 12px",
                  borderRadius: "12px",
                  border: pushEnabled ? "1px solid #72dca7" : "1px solid #e6c98f",
                  background: pushEnabled ? "#174d38" : "#fff3d7",
                  color: pushEnabled ? "#d9ffeb" : "#3b291f",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: "900",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 2147483647,
                  pointerEvents: "auto"
                }}
                aria-label="1:1 알림 켜기"
              >
                <span style={{fontSize:"17px",pointerEvents:"none"}}>🔔</span>
                <span style={{pointerEvents:"none"}}>{pushEnabled ? "알림 ON" : "알림 켜기"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProfileInfo(true)}
                style={styles.refMyInfoButton}
                className="vip-myinfo-button"
                aria-label="내 정보 보기"
              >
                <img
                  src={avatarSrc(profile.avatar)}
                  alt=""
                  style={styles.refMyInfoAvatar}
                />
                <span>내 정보</span>
              </button>
              <button type="button" onClick={handleLogout} style={styles.refLogoutButton} className="vip-logout-button" title="로그아웃" aria-label="로그아웃">
                <span className="vip-logout-label">로그아웃</span>
              </button>
            </div>
          </header>

          <nav style={styles.refNav} className="vip-app-nav">
            {navItems.map((nav) => {
              const active = chatTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => changeTab(nav.id)}
                  style={{...styles.refNavButton, ...(active ? styles.refNavButtonActive : {})}}
                >
                  {nav.icon === "bars" ? (
                    <span style={styles.refAiBars} aria-hidden="true">
                      <i style={{height:"8px",width:"4px",borderRadius:"2px",background:"currentColor",display:"block"}}></i>
                      <i style={{height:"14px",width:"4px",borderRadius:"2px",background:"currentColor",display:"block"}}></i>
                      <i style={{height:"20px",width:"4px",borderRadius:"2px",background:"currentColor",display:"block"}}></i>
                    </span>
                  ) : (
                    <span style={styles.refNavIcon}>{nav.icon}</span>
                  )}
                  <span>{nav.label}</span>
                  {nav.id === "private" && unreadPrivate > 0 && <i style={styles.refNavBadge}>{unreadPrivate}</i>}
                </button>
              );
            })}
          </nav>

          {showAvatarPicker && (
            <div style={styles.refAvatarPicker} className="vip-avatar-picker">
              <div style={styles.refAvatarPickerTop} className="vip-avatar-picker-top">
                <div><strong>내 프로필 고르기</strong><small>고해상도 귀여운 동물 프로필 · 40종</small></div>
                <button type="button" onClick={() => setShowAvatarPicker(false)}>×</button>
              </div>
              <div style={styles.refAvatarGrid} className="vip-avatar-grid">
                {AVATAR_CATALOG.map((item) => (
                  <button key={item.key} type="button" onClick={() => saveAvatar(item.key)} style={styles.refAvatarChoice} className={`vip-avatar-choice ${profile.avatar === item.key ? "is-selected" : ""}`} title={item.label}>
                    <span className="vip-avatar-thumb"><img src={avatarSrc(item.key)} alt={item.label} /></span>
                    <span className="vip-avatar-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showInstallGuide && (
            <div style={styles.installGuideBackdrop} onClick={() => setShowInstallGuide(false)}>
              <div style={styles.installGuideCard} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setShowInstallGuide(false)} style={styles.installGuideClose}>×</button>
                <div style={styles.installGuideIcon}>📲</div>
                <div style={styles.installGuideEyebrow}>AI PROCESS VIP</div>
                <h3 style={styles.installGuideTitle}>홈 화면에 VIP 앱 추가</h3>

                {isIOSDevice() ? (
                  <>
                    <p style={styles.installGuideText}>
                      아이폰은 보안 정책상 사이트 버튼으로 홈 화면 아이콘을 자동 생성할 수 없습니다.
                      <br />Safari에서 아래 순서로 한 번만 추가해주세요.
                    </p>
                    <div style={styles.installGuideSteps}>
                      <div><b>1</b><span>Safari의 <strong>공유 버튼</strong> 누르기</span></div>
                      <div><b>2</b><span>메뉴에서 <strong>홈 화면에 추가</strong> 선택</span></div>
                      <div><b>3</b><span><strong>추가</strong> 후 홈 화면의 VIP 아이콘 실행</span></div>
                      <div><b>4</b><span>VIP 앱에서 <strong>🔔 알림</strong> → 허용</span></div>
                    </div>
                    <div style={styles.installGuideTip}>Chrome·카카오·인스타 내부 브라우저라면 Safari에서 사이트를 먼저 열어주세요.</div>
                  </>
                ) : (
                  <>
                    <p style={styles.installGuideText}>
                      자동 설치창을 사용할 수 없는 브라우저입니다.
                      <br />브라우저 메뉴의 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해주세요.
                    </p>
                    <button type="button" onClick={() => setShowInstallGuide(false)} style={styles.installGuideOk}>확인</button>
                  </>
                )}
              </div>
            </div>
          )}

          {showProfileInfo && (
            <div style={styles.refProfileOverlay} onClick={() => setShowProfileInfo(false)}>
              <div style={styles.refProfileCard} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setShowProfileInfo(false)} style={styles.refProfileClose}>×</button>
                <img
                  src={avatarSrc(profile.avatar)}
                  alt="내 프로필"
                  style={styles.refProfileLarge}
                />
                <div style={styles.refProfileVip}>AI PROCESS VIP</div>
                <strong style={styles.refProfileName}>{profile.nickname}</strong>
                <div style={styles.refProfileRows}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 13px",borderBottom:"1px solid #eadbc7"}}><span style={{color:"#8a7768"}}>닉네임</span><b>{profile.nickname || "-"}</b></div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 13px",borderBottom:"1px solid #eadbc7"}}><span style={{color:"#8a7768"}}>성함</span><b>{profile.real_name || "-"}</b></div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 13px",borderBottom:"1px solid #eadbc7"}}><span style={{color:"#8a7768"}}>회원등급</span><b>{profile.role === "admin" ? "관리자" : "VIP 회원"}</b></div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 13px"}}><span style={{color:"#8a7768"}}>승인상태</span><b>{profile.approval_status === "approved" ? "승인 완료" : profile.approval_status}</b></div>
                </div>
                <p style={styles.refProfileNote}>비밀번호는 보안상 화면에 표시되지 않습니다.</p>
                <button type="button" onClick={() => {setShowProfileInfo(false); setShowAvatarPicker(true);}} style={styles.refProfileEdit}>
                  프로필 캐릭터 변경
                </button>
              </div>
            </div>
          )}

          <div style={styles.refBody} className="vip-app-body">
            {profile?.role === "admin" && adminMemberLoadError && (
              <div style={{margin:"0 0 14px",padding:"12px 14px",border:"1px solid #8f4f58",borderRadius:"12px",background:"#2b1720",color:"#ffd8dd",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",fontSize:"12px"}}>
                <span>회원 목록을 불러오지 못했습니다. 관리자 회원관리 SQL을 적용한 뒤 다시 시도해주세요.</span>
                <button type="button" onClick={loadAdminAllMembers} style={{border:"1px solid #b56c76",background:"#4a2630",color:"#fff",borderRadius:"9px",padding:"7px 10px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>다시 불러오기</button>
              </div>
            )}
            {chatTab === "home" && profile?.role !== "admin" && (
              <div className="vip-home-v20">
                <section className="vip-home-v20-welcome">
                  <div><span>AI PROCESS VIP</span><h2>{profile.nickname}님, 지금 확인할 내용입니다.</h2><p>대화, 진행 중인 PROCESS, 이벤트를 한 화면에서 빠르게 확인하세요.</p></div>
                  <img src={avatarSrc(profile.avatar)} alt="프로필" />
                </section>
                <section className="vip-home-v20-alerts">
                  {unreadPrivate > 0 && <button type="button" onClick={() => changeTab("private")}><i>🎧</i><span><b>1:1 새 답변 {unreadPrivate}</b><small>관리자 답변을 확인하세요</small></span><em>›</em></button>}
                  {activeEvent && <button type="button" onClick={() => changeTab("event")}><i>🎁</i><span><b>{activeEvent.participated ? "이벤트 참여 완료" : "이벤트 지금 참여 가능"}</b><small>{activeEvent.title}</small></span><em>›</em></button>}
                  {aiSession?.status === "running" && <button type="button" onClick={() => changeTab("ai")}><i>◆</i><span><b>AI PROCESS 진행 중</b><small>{aiKrw(aiSession?.current_amount || aiCurrentStartMoney)} · {aiSignedPct(aiSession?.total_return || 0)}</small></span><em>›</em></button>}
                  {unreadPrivate === 0 && !activeEvent && aiSession?.status !== "running" && <div className="vip-home-v20-quiet"><i>✓</i><span><b>새로 확인할 알림이 없습니다.</b><small>필요한 기능은 아래에서 바로 이용할 수 있습니다.</small></span></div>}
                </section>
                <section className="vip-home-v20-section">
                  <div className="vip-home-v20-section-head"><div><span>COMMUNICATION</span><h3>대화</h3></div><small>자주 쓰는 공간</small></div>
                  <div className="vip-home-v20-chatlist">
                    <button type="button" onClick={() => changeTab("group")}><div className="vip-home-v20-chat-icon is-group">💬</div><div className="vip-home-v20-chat-copy"><b>VIP 그룹채팅</b><span>{memberGroupChatLocked ? "현재 운영시간 외 · 11:00~18:30" : "지금 대화 가능 · VIP 회원 " + approvedMemberCount + "명"}</span></div><div className="vip-home-v20-chat-meta"><small>{memberGroupChatLocked ? "OFF" : "LIVE"}</small><em>›</em></div></button>
                    <button type="button" onClick={() => changeTab("private")}><div className="vip-home-v20-chat-icon is-private">🎧</div><div className="vip-home-v20-chat-copy"><b>1:1 문의</b><span>{unreadPrivate > 0 ? "새 답변 " + unreadPrivate + "건이 있습니다." : "관리자와 개인 상담 및 지급 안내"}</span></div><div className="vip-home-v20-chat-meta">{unreadPrivate > 0 && <strong>{unreadPrivate}</strong>}<em>›</em></div></button>
                  </div>
                </section>
                <section className="vip-home-v20-process" onClick={() => changeTab("ai")} role="button" tabIndex={0}>
                  <div className="vip-home-v20-process-top"><span>MY AI PROCESS</span><em>{aiSession?.status === "running" ? "진행 중" : "대기"}</em></div>
                  <div className="vip-home-v20-process-main"><div><small>현재 평가금액</small><strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "진행 중인 PROCESS가 없습니다"}</strong></div>{aiSession?.status === "running" && <b className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(aiSession?.total_profit || 0)} · {aiSignedPct(aiSession?.total_return || 0)}</b>}</div>
                  <div className="vip-home-v20-process-foot"><span>{aiSession?.status === "running" ? "다음 반영 " + aiCountdown : "관리자가 PROCESS 시작 시 자동 표시됩니다."}</span><em>자세히 보기 ›</em></div>
                </section>
                {featuredEvent && <button type="button" className="vip-home-v20-event" onClick={() => changeTab("event")}><div><span>{activeEvent ? "LIVE EVENT" : "NEXT EVENT"}</span><h3>{featuredEvent.title}</h3><p>{activeEvent ? (featuredEvent.participated ? "참여 완료 · 결과를 기다려주세요" : "지금 참여할 수 있습니다") : formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at)}</p></div><div className="vip-home-v20-event-icon">{eventIcon(featuredEvent.event_type)}</div></button>}
              </div>
            )}
            {chatTab === "admin" && profile?.role === "admin" && (
              <div className="vip-admin-dashboard vip-master-admin">
                <section className="vip-admin-page-head">
                  <div>
                    <span>ADMIN DASHBOARD</span>
                    <h2>관리자 대시보드</h2>
                    <p>회원, AI PROCESS, 이벤트, 문의 상태를 한 화면에서 확인합니다.</p>
                  </div>
                  <div className="vip-admin-status"><i></i> SYSTEM ONLINE</div>
                </section>

                <section className="vip-admin-kpis vip-admin-kpis-premium">
                  <button type="button" onClick={() => { setAdminMemberFilter("approved"); setMemberSearch(""); changeTab("members"); }}>
                    <span>전체 회원</span><strong>{adminApprovedMembers.length.toLocaleString("ko-KR")}명</strong><small>승인된 일반 회원</small>
                  </button>
                  <button type="button" onClick={() => { setAdminMemberFilter("pending"); setMemberSearch(""); changeTab("members"); }}>
                    <span>승인 대기</span><strong>{adminPendingMembers.length.toLocaleString("ko-KR")}명</strong><small>신규 가입 신청</small>
                  </button>
                  <button type="button" onClick={() => changeTab("ai")}>
                    <span>진행 중 프로젝트</span><strong>{aiPublicSessions.length.toLocaleString("ko-KR")}개</strong><small>AI PROCESS LIVE</small>
                  </button>
                  <button type="button" onClick={() => changeTab("private")}>
                    <span>읽지 않은 문의</span><strong>{unreadPrivate.toLocaleString("ko-KR")}건</strong><small>1:1 상담 확인</small>
                  </button>
                </section>

                <section className="vip-admin-overview-grid">
                  <div className="vip-admin-panel vip-admin-metric-panel">
                    <div className="vip-admin-panel-head">
                      <div><span>OPERATIONS</span><strong>운영 현황 추이</strong></div>
                      <small>실시간 기준</small>
                    </div>
                    <div className="vip-admin-metric-bars vip-admin-trend-bars">
                      {[
                        ["회원", adminApprovedMembers.length, "approved"],
                        ["대기", adminPendingMembers.length, "pending"],
                        ["PROCESS", aiPublicSessions.length, "process"],
                        ["문의", unreadPrivate, "unread"],
                      ].map(([label,count,tone]) => {
                        const maxValue = Math.max(1, adminApprovedMembers.length, adminPendingMembers.length, aiPublicSessions.length, unreadPrivate);
                        const height = Math.max(14, Math.round((Number(count || 0) / maxValue) * 100));
                        return (
                          <div className="vip-admin-metric-item" key={label}>
                            <div className="vip-admin-metric-track"><i className={`is-${tone}`} style={{height:`${height}%`}}></i></div>
                            <b>{Number(count || 0).toLocaleString("ko-KR")}</b>
                            <span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="vip-admin-panel vip-admin-status-panel">
                    <div className="vip-admin-panel-head">
                      <div><span>MEMBER STATUS</span><strong>회원 현황</strong></div>
                      <button type="button" onClick={() => { setAdminMemberFilter("all"); changeTab("members"); }}>전체 보기</button>
                    </div>
                    <div className="vip-admin-status-body">
                      <div className="vip-admin-donut" style={{background:`conic-gradient(#4c9cff 0 ${Math.round((adminApprovedMembers.length / Math.max(1, adminApprovedMembers.length + adminPendingMembers.length + adminRejectedMembers.length)) * 100)}%, #f1b84c 0 ${Math.round(((adminApprovedMembers.length + adminPendingMembers.length) / Math.max(1, adminApprovedMembers.length + adminPendingMembers.length + adminRejectedMembers.length)) * 100)}%, #e76d7a 0 100%)`}}>
                        <div><strong>{(adminApprovedMembers.length + adminPendingMembers.length + adminRejectedMembers.length).toLocaleString("ko-KR")}</strong><span>전체 회원</span></div>
                      </div>
                      <div className="vip-admin-status-legend">
                        <button type="button" onClick={() => { setAdminMemberFilter("approved"); changeTab("members"); }}><i className="is-approved"></i><span>승인 완료</span><b>{adminApprovedMembers.length}명</b></button>
                        <button type="button" onClick={() => { setAdminMemberFilter("pending"); changeTab("members"); }}><i className="is-pending"></i><span>승인 대기</span><b>{adminPendingMembers.length}명</b></button>
                        <button type="button" onClick={() => { setAdminMemberFilter("rejected"); changeTab("members"); }}><i className="is-rejected"></i><span>거절</span><b>{adminRejectedMembers.length}명</b></button>
                        <button type="button" onClick={() => changeTab("ai")}><i className="is-process"></i><span>PROCESS 진행</span><b>{aiPublicSessions.length}명</b></button>
                      </div>
                    </div>
                  </div>

                  <div className="vip-admin-panel vip-admin-requests-panel">
                    <div className="vip-admin-panel-head">
                      <div><span>NEW MEMBER REQUEST</span><strong>최근 가입 신청</strong></div>
                      <button type="button" onClick={() => { setAdminMemberFilter("pending"); changeTab("members"); }}>전체 보기 ›</button>
                    </div>
                    <div className="vip-admin-request-table">
                      <div className="vip-admin-request-head"><span>회원</span><span>가입일</span><span>상태</span><span>관리</span></div>
                      {adminPendingMembers.slice(0, 5).map((member) => (
                        <div key={member.member_id} className="vip-admin-request-row">
                          <div className="vip-admin-request-user"><img src={avatarSrc(member.avatar)} alt=""/><span><b>{member.nickname}</b><small>{member.real_name || "성함 미입력"}</small></span></div>
                          <span>{member.created_at ? new Intl.DateTimeFormat("ko-KR", {year:"2-digit",month:"2-digit",day:"2-digit"}).format(new Date(member.created_at)) : "-"}</span>
                          <i>승인 대기</i>
                          <div>
                            <button type="button" disabled={working} onClick={() => setMemberApproval(member.member_id, "approved")}>승인</button>
                            <button type="button" className="is-danger" disabled={working} onClick={() => setMemberApproval(member.member_id, "rejected")}>거절</button>
                          </div>
                        </div>
                      ))}
                      {!adminPendingMembers.length && <p className="vip-admin-request-empty">현재 승인 대기 회원이 없습니다.</p>}
                    </div>
                  </div>
                </section>

                <section className="vip-admin-quick-grid">
                  <button type="button" onClick={() => {setAdminMemberFilter("all"); changeTab("members");}}><span>♙</span><div><b>회원 관리</b><small>승인·상태·문의 연결</small></div><em>›</em></button>
                  <button type="button" onClick={() => changeTab("ai")}><span>▥</span><div><b>AI PROCESS</b><small>시작·진행·종료 관리</small></div><em>›</em></button>
                  <button type="button" onClick={() => changeTab("event")}><span>🎁</span><div><b>이벤트 관리</b><small>자동 이벤트 현황 확인</small></div><em>›</em></button>
                  <button type="button" onClick={() => changeTab("private")}><span>🎧</span><div><b>1:1 문의</b><small>{unreadPrivate ? `미확인 ${unreadPrivate}건` : "새 문의 없음"}</small></div><em>›</em></button>
                </section>
              </div>
            )}

            {chatTab === "members" && profile?.role === "admin" && (
              <div className="vip-admin-members-screen">
                <section className="vip-admin-members-head">
                  <div><span>MEMBER MANAGEMENT</span><h2>회원 관리</h2><p>회원 승인 상태와 AI PROCESS 진행 여부를 확인하고 1:1 상담으로 바로 이동합니다.</p></div>
                  <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button
                      type="button"
                      disabled={aiAccountsWorking}
                      onClick={syncAiCharacterAccounts}
                      style={{border:"1px solid #d8c8b5",background:"#fffaf2",color:"#6e5234",borderRadius:"12px",padding:"10px 13px",fontWeight:800,cursor:"pointer"}}
                    >
                      {aiAccountsWorking ? "30명 생성 중..." : "AI 캐릭터 30명 생성/동기화"}
                    </button>
                    <div className="vip-admin-members-total"><span>승인 회원</span><strong>{adminApprovedMembers.length}명</strong></div>
                  </div>
                </section>

                <section className="vip-admin-member-toolbar">
                  <div className="vip-admin-member-filters">
                    {[
                      ["all", "전체", adminApprovedMembers.length + adminPendingMembers.length + adminRejectedMembers.length],
                      ["pending", "승인 대기", adminPendingMembers.length],
                      ["approved", "승인 완료", adminApprovedMembers.length],
                      ["rejected", "거절", adminRejectedMembers.length],
                    ].map(([value,label,count]) => (
                      <button key={value} type="button" className={adminMemberFilter === value ? "is-active" : ""} onClick={() => setAdminMemberFilter(value)}>{label}<b>{count}</b></button>
                    ))}
                  </div>
                  <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="닉네임 또는 성함 검색"/>
                </section>

                <section className="vip-admin-member-table">
                  <div className="vip-admin-member-row vip-admin-member-row-head"><span>회원</span><span>가입일</span><span>상태</span><span>AI PROCESS</span><span>관리</span></div>
                  {adminVisibleMembers.map((member) => {
                    const running = aiPublicSessions.some((session) => session.user_id === member.member_id);
                    return (
                      <div className="vip-admin-member-row" key={member.member_id}>
                        <div className="vip-admin-member-identity"><img src={avatarSrc(member.avatar)} alt=""/><span><b>{member.nickname}{member.account_type && member.account_type !== "human" && <em style={{marginLeft:"6px",fontStyle:"normal",fontSize:"10px",padding:"2px 6px",borderRadius:"999px",background:member.account_type==="ai_character"?"#eaf3ff":"#fff2dc",color:member.account_type==="ai_character"?"#315e9b":"#8a5a22"}}>{accountTypeLabel(member.account_type)}</em>}</b><small>{member.real_name || "성함 미입력"}</small></span></div>
                        <span className="vip-admin-member-date">{member.created_at ? new Intl.DateTimeFormat("ko-KR", {year:"2-digit",month:"2-digit",day:"2-digit"}).format(new Date(member.created_at)) : "-"}</span>
                        <span className={`vip-admin-member-state is-${member.approval_status}`}>{member.approval_status === "approved" ? "승인 완료" : member.approval_status === "pending" ? "승인 대기" : "거절"}</span>
                        <span className={`vip-admin-process-state ${running ? "is-running" : ""}`}>{running ? "진행 중" : "대기"}</span>
                        <div className="vip-admin-member-actions">
                          <select
                            value={member.account_type || "human"}
                            onChange={(e) => changeMemberAccountType(member, e.target.value)}
                            style={{border:"1px solid #ddd0c2",borderRadius:"9px",padding:"7px 8px",background:"#fff",fontSize:"11px",fontWeight:700}}
                            title="관리자에게만 보이는 계정 종류"
                          >
                            <option value="human">일반회원</option>
                            <option value="ai_character">AI 캐릭터</option>
                            <option value="managed">가라계정</option>
                          </select>
                          {member.approval_status === "pending" && <><button type="button" disabled={working} onClick={() => setMemberApproval(member.member_id, "approved")}>승인</button><button type="button" className="is-danger" disabled={working} onClick={() => setMemberApproval(member.member_id, "rejected")}>거절</button></>}
                          {member.approval_status === "approved" && <button type="button" onClick={() => openAdminMemberChat(member)}>1:1 문의</button>}
                          {member.approval_status === "rejected" && <button type="button" disabled={working} onClick={() => setMemberApproval(member.member_id, "approved")}>다시 승인</button>}
                        </div>
                      </div>
                    );
                  })}
                  {!adminVisibleMembers.length && <div className="vip-admin-member-empty">조건에 맞는 회원이 없습니다.</div>}
                </section>
              </div>
            )}

            {chatTab === "group" && (
              <div style={styles.refScreen}>
                <div style={styles.refMemberStrip}>
                  <img
                    src={avatarSrc(profile.avatar)}
                    alt=""
                    style={styles.refMemberStripAvatar}
                  />
                  <div style={styles.refRoomIdentity}>
                    <div style={styles.refRoomNameRow}>
                      <strong>{profile.nickname}</strong>
                      <em style={styles.refVipBadge}>VIP</em>
                    </div>
                    <span style={styles.refOnlineText}><i style={styles.refOnlineDot}></i>온라인</span>
                  </div>
                  <div style={styles.refMemberCount}>
                    <span style={styles.refMemberCountIcon}>
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7"/>
                        <circle cx="16.5" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".72"/>
                        <path d="M3.8 18c.5-3.1 2.4-4.8 5.2-4.8s4.8 1.7 5.3 4.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                        <path d="M14.4 14.2c2.8-.5 4.9.9 5.5 3.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".72"/>
                      </svg>
                    </span>
                    <span style={styles.refMemberCountLabel}>MEMBERS</span>
                    <strong style={styles.refMemberCountNumber}>{approvedMemberCount.toLocaleString("ko-KR")}명</strong>
                  </div>
                  {profile?.role === "admin" && (
                    <button type="button" onClick={toggleGroupChatFreeze} style={styles.refAdminMini}>
                      {chatFrozen ? "채팅 열기" : "채팅 잠금"}
                    </button>
                  )}
                </div>

                {memberGroupChatLocked && (
                  <div style={styles.refLockNotice}>🔒 그룹채팅 운영시간은 11:00 ~ 18:30입니다.</div>
                )}

                {profile?.role !== "admin" && (activeEvent || memberUnreadCount > 0 || aiSession?.status === "running") && (
                  <div style={{display:"flex",gap:"7px",padding:"8px 12px",background:"#fff8eb",borderBottom:"1px solid #ead9bd",overflowX:"auto",flexShrink:0}}>
                    {activeEvent && (
                      <button type="button" onClick={() => setChatTab("event")} style={{border:"1px solid #dfbe7b",background:activeEvent.participated?"#f7f0e2":"#fff1ca",color:"#5a3a18",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>
                        {activeEvent.participated ? "✓ 이벤트 참여 완료" : "🎁 이벤트 바로 참여"}
                      </button>
                    )}
                    {aiSession?.status === "running" && (
                      <button type="button" onClick={() => setChatTab("ai")} style={{border:"1px solid #c6d5e8",background:"#eef5ff",color:"#173b69",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>◆ AI PROCESS 진행 중</button>
                    )}
                    {memberUnreadCount > 0 && (
                      <button type="button" onClick={() => setChatTab("private")} style={{border:"1px solid #dfc9aa",background:"#fff",color:"#5a3a18",borderRadius:"999px",padding:"7px 11px",fontSize:"11px",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer"}}>🎧 1:1 새 답변 {memberUnreadCount}</button>
                    )}
                  </div>
                )}

                <div ref={groupMessagesRef} style={styles.refMessages}>
                  {messages.length === 0 ? (
                    <div style={styles.refEmpty}>아직 대화가 없습니다.<br/>첫 메시지를 남겨보세요.</div>
                  ) : messages.map((item, index) => {
                    const mine = item.member_id === user.id;
                    const senderId = item.ai_character_id || item.member_id;
                    const avatar = memberAvatars[senderId] || "profile-01";
                    const previous = index > 0 ? messages[index - 1] : null;
                    const showDate = !previous || chatDateKey(previous.created_at) !== chatDateKey(item.created_at);
                    return (
                      <Fragment key={item.id}>
                        {showDate && <div style={styles.refDateChip}>{formatChatDate(item.created_at)}</div>}
                        <div style={{...styles.refMsgRow, justifyContent: mine ? "flex-end" : "flex-start"}}>
                          {!mine && (
                            <img
                              src={avatarSrc(avatar)}
                              alt=""
                              style={styles.refMsgAvatar}
                              onClick={() => profile?.role === "admin" && !item.ai_character_id && adminKickMember(item.member_id, getMessageNickname(item))}
                            />
                          )}
                          <div style={{maxWidth:"76%"}}>
                            {!mine && <div style={styles.refMsgName}>{getMessageNickname(item)}{adminAccountBadge(item.member_id)}</div>}
                            <div style={{display:"flex",gap:"6px",alignItems:"flex-end",flexDirection:mine?"row-reverse":"row"}}>
                              <div style={{...styles.refBubble,...(mine?styles.refMyBubble:styles.refOtherBubble)}}>
                                {renderMessageContent(item.content)}
                              </div>
                              <span style={styles.refMsgTime}>{formatChatTime(item.created_at)}</span>
                              {profile?.role === "admin" && (
                                <button type="button" onClick={() => adminDeleteGroupMessage(item.id)} style={styles.refDelete}>×</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                  <div ref={groupBottomRef} style={{height:"1px",width:"100%"}} />
                </div>

                {featuredEvent && (
                  <button type="button" onClick={() => setChatTab("event")} style={styles.refNextEvent}>
                    <div style={styles.refNextGift}>{eventIcon(featuredEvent.event_type)}</div>
                    <div style={styles.refNextCopy}>
                      <span>{activeEvent ? "LIVE EVENT" : "NEXT EVENT"}</span>
                      <strong>{featuredEvent.title}</strong>
                      <small>{activeEvent ? (featuredEvent.participated ? "✓ 참여 완료 · 결과를 기다려주세요" : "지금 참여 가능 · 눌러서 바로 이동") : (formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at))}</small>
                    </div>
                    <div style={styles.refNextArrow}>›</div>
                  </button>
                )}

                <form onSubmit={sendMessage} style={styles.refComposer}>
                  <label style={styles.refPlus}>
                    +
                    <input type="file" accept="image/*" hidden onChange={(e) => uploadChatImage(e.target.files?.[0], "group")} />
                  </label>
                  <div ref={groupEmojiRef} style={styles.refEmojiWrap}>
                    <button
                      type="button"
                      onClick={() => setShowGroupEmoji((v) => !v)}
                      style={styles.refEmojiButton}
                      aria-label="이모티콘"
                    >
                      ☺
                    </button>
                    {showGroupEmoji && (
                      <div style={styles.refEmojiPanel}>
                        {CHAT_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            style={styles.refEmojiItem}
                            onClick={() => {
                              setMessage((prev) => `${prev}${emoji}`);
                              setShowGroupEmoji(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    disabled={memberGroupChatLocked}
                    placeholder={memberGroupChatLocked ? "현재 채팅 이용 시간이 아닙니다." : "메시지를 입력하세요..."}
                    style={styles.refInput}
                  />
                  <button type="submit" disabled={memberGroupChatLocked} style={styles.refSend}>➤</button>
                </form>
              </div>
            )}

            {chatTab === "event" && (
              <div style={styles.refEventScreen}>
                {eventSuccess && (
                  <div style={styles.refEventSuccessToast} role="status">
                    <div style={styles.refEventSuccessCheck}>✓</div>
                    <div style={styles.refEventSuccessCopy}>
                      <strong style={{fontSize:"11px",letterSpacing:".2px"}}>참여 완료</strong>
                      <span style={{fontSize:"9px",color:"#ccebdd",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{eventSuccess.message}</span>
                    </div>
                  </div>
                )}
                {featuredEvent && (
                  <div style={{...styles.refHeroEvent, backgroundImage:eventHeroBackground(featuredEvent.event_type)}}>
                    <div style={styles.refHeroEventTop}>
                      <span>{activeEvent ? "◆ LIVE" : "◆ NEXT"}</span>
                      <b>⏱ {formatEventTime(featuredEvent.starts_at)} ~ {formatEventTime(featuredEvent.ends_at)}</b>
                    </div>
                    <div style={styles.refHeroEventMain}>
                      <div style={styles.refEventArtwork}>
                        <div style={styles.refEventArtworkHalo}></div>
                        <div style={styles.refHeroTarget}>{eventIcon(featuredEvent.event_type)}</div>
                        <span>VIP</span>
                      </div>
                      <div style={{position:"relative",zIndex:2}}>
                        <strong style={{fontSize:"20px"}}>{featuredEvent.title}</strong>
                        <p style={{margin:"6px 0 0",lineHeight:1.55,color:"#f0dfd1"}}>{featuredEvent.description}</p>
                      </div>
                    </div>
                    {activeEvent && !featuredEvent.participated ? (
                      <button type="button" onClick={() => document.getElementById(`ref-event-${featuredEvent.event_id}`)?.scrollIntoView({behavior:"smooth"})}>
                        지금 참여하기 <span>›</span>
                      </button>
                    ) : (
                      <div style={styles.refHeroDisabled}>{featuredEvent.participated ? "✓ 참여 완료" : "시작 대기 중"}</div>
                    )}
                  </div>
                )}

                <div style={styles.refSectionTitle}>
                  <div><strong>오늘의 이벤트</strong><span>자동 진행 일정</span></div>
                  <small>{autoEvents.length}개 회차</small>
                </div>

                <div style={styles.refEventList}>
                  {getSortedAutoEvents().map((item) => {
                    const active = item.status === "active";
                    const done = item.status === "completed";
                    const participated = Boolean(item.participated);
                    return (
                      <div id={`ref-event-${item.event_id}`} key={item.event_id} style={{...styles.refEventRow,...(active?styles.refEventRowActive:{})}}>
                        <div style={styles.refRound}>{item.round_number}<span>회</span></div>
                        <div style={styles.refEventIcon}>{eventIcon(item.event_type)}</div>
                        <div style={styles.refEventInfo}>
                          <small>{formatEventTime(item.starts_at)} ~ {formatEventTime(item.ends_at)}</small>
                          <strong>{item.title}</strong>
                          {active && !participated && <div style={styles.refInlineGame}>{renderEventGame(item, active, participated)}</div>}
                          {item.winner_nickname && <em>🏆 {item.winner_nickname}</em>}
                        </div>
                        <div style={{...styles.refStatus,...(active?styles.refStatusLive:done?styles.refStatusDone:styles.refStatusWait)}}>
                          {participated ? "참여완료" : active ? "진행중" : done ? "종료" : "대기"}
                        </div>
                        <div style={styles.refChevron}>›</div>
                      </div>
                    );
                  })}
                </div>
                {notice && <div style={styles.refNotice}>{notice}</div>}
              </div>
            )}

            {chatTab === "ai" && (
              <div style={{...styles.refAiScreen,...styles.refAiScreenV2}} className="ai-v2-shell">
                <section className="ai-v2-hero">
                  <div className="ai-v2-hero-copy">
                    <div className="ai-v2-eyebrow"><span className="ai-v2-live-dot"></span> AI PROCESS · LIVE</div>
                    <h2>내 AI PROCESS</h2>
                    <p>현재 평가금액과 자산 흐름, 시장 연동 상태를 확인하세요.</p>
                    <div className="ai-v2-status-row">
                      <span className={`ai-v2-status ${aiSession?.status === "running" ? "is-running" : "is-done"}`}>{aiSession?.status === "running" ? "진행 중" : "대기"}</span>
                      <span>다음 PROCESS 갱신 <b>{aiCountdown}</b></span>
                      <span>최근 반영 <b>{aiTime(aiSim?.updatedAt)}</b></span>
                    </div>
                  </div>
                  <div className="ai-v2-hero-result">
                    <span>현재 평가금액</span>
                    <strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "대기 중"}</strong>
                    <em className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>
                      {aiSession?.status === "running" ? `${aiSignedKrw(aiSession?.total_profit || 0)} · ${aiSignedPct(aiSession?.total_return || 0)}` : ""}
                    </em>
                    {aiLastResult && (
                      <small>최근 연동 · {aiLastResult.name} {aiSignedPct(aiLastResult.intervalPct)}</small>
                    )}
                  </div>
                </section>

                {profile?.role !== "admin" && aiSessions.length > 1 && (
                  <section className="ai-v2-process-switcher">
                    <div className="ai-v2-process-switcher-head">
                      <span>MY PROCESS</span>
                      <strong>진행 중인 AI PROCESS 선택</strong>
                      <small>{aiSessions.filter((item) => item.status === "running").length}개 진행 중 · 완료 기록 포함 {aiSessions.length}개</small>
                    </div>
                    <div className="ai-v2-process-switcher-list">
                      {aiSessions.map((item, index) => (
                        <button
                          type="button"
                          key={item.id || `${item.started_at}-${index}`}
                          className={item.id === aiSession?.id ? "is-active" : ""}
                          onClick={() => {
                            setAiSelectedProcessId(item.id);
                            setAiSession(item);
                            setAiSim(null);
                          }}
                        >
                          <span>PROCESS #{String(item.id || "").slice(0, 6).toUpperCase()}</span>
                          <b>{aiKrw(item.current_amount || item.start_amount)}</b>
                          <em className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</em>
                          <small>{item.status === "running" ? (item.ends_at ? aiRemainingText({startedAt:item.started_at,durationHours:item.duration_hours}) : "기간 미정") : item.status === "completed" ? "완료" : "종료"}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {profile?.role === "admin" && (
                  <section className="ai-v2-admin-console">
                    <div className="ai-v2-admin-head"><div><span>ADMIN CONTROL</span><strong>회원 AI PROCESS 추가</strong></div><small>동일 회원 다중 진행 가능</small></div>
                    <div className="ai-v2-admin-form">
                      <select value={aiAdminMemberId} onChange={(e) => setAiAdminMemberId(e.target.value)}>
                        <option value="">회원 선택</option>
                        {adminApprovedMembers.map((member) => <option key={member.member_id} value={member.member_id}>{member.nickname}{member.account_type === "ai_character" ? " · AI" : member.account_type === "managed" ? " · 가라" : ""}</option>)}
                      </select>
                      <input value={aiAdminAmount} onChange={(e) => setAiAdminAmount(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" placeholder="운용금액"/>
                      <div className="ai-v2-duration-control">
                        <div className="ai-v2-duration-tabs">
                          <button type="button" className={!aiAdminIndefinite ? "is-active" : ""} onClick={() => setAiAdminIndefinite(false)}>시간 지정</button>
                          <button type="button" className={aiAdminIndefinite ? "is-active" : ""} onClick={() => setAiAdminIndefinite(true)}>기간 미정</button>
                        </div>
                        {!aiAdminIndefinite ? (
                          <input value={aiAdminDurationHours} onChange={(e) => setAiAdminDurationHours(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" placeholder="진행 시간"/>
                        ) : (
                          <div className="ai-v2-indefinite-label"><b>∞ 기간 미정</b><span>관리자가 종료할 때까지 진행</span></div>
                        )}
                      </div>
                      <button type="button" onClick={adminStartAiProcess} disabled={aiAdminWorking || !aiAdminMemberId}>{aiAdminWorking ? "처리 중" : "PROCESS START"}</button>
                    </div>
                  </section>
                )}

                <div className="ai-v2-summary-grid">
                  <div className="ai-v2-summary-card"><span>시작 운용금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiCurrentStartMoney) : "대기"}</strong><small>프로세스 시작 기준</small></div>
                  <div className="ai-v2-summary-card"><span>현재 평가금액</span><strong>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "-"}</strong><small>1분 단위 현재금액 갱신</small></div>
                  <div className="ai-v2-summary-card"><span>누적 손익</span><strong className={(aiSession?.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSession?.status === "running" ? aiSignedKrw(aiSession?.total_profit || 0) : "-"}</strong><small>{aiSession?.status === "running" ? aiSignedPct(aiSession?.total_return || 0) : "PROCESS WAIT"}</small></div>
                  <div className="ai-v2-summary-card"><span>진행 기간</span><strong>{aiSession?.status === "running" ? (aiSession?.ends_at ? aiRemainingText({startedAt:aiSession.started_at,durationHours:aiSession.duration_hours}) : "기간 미정") : "대기"}</strong><small>{aiSession?.status === "running" && !aiSession?.ends_at ? "관리자 종료 시까지 진행" : "최대 30일 진행"}</small></div>
                  <div className="ai-v2-summary-card"><span>5분 시장</span><strong>{aiPositiveMarkets}↑ / {aiNegativeMarkets}↓</strong><small>주식·코인 8종 · 5분</small></div>
                </div>

                <section className="ai-v2-live-members">
                  <div className="ai-v2-live-members-head">
                    <div><span>LIVE MEMBERS</span><strong>지금 함께 진행 중인 회원</strong><small>다른 회원은 요약 수익만 표시됩니다.</small></div>
                    <div className="ai-v2-live-count"><i></i>{aiPublicSessions.length}건 진행 중</div>
                  </div>
                  {aiPublicLoading && !aiPublicSessions.length ? <div className="ai-v2-live-empty">진행 현황을 불러오는 중입니다.</div> : aiPublicSessions.length ? (
                    <div className="ai-v2-live-member-grid">
                      {aiPublicSessions.map((item) => (
                        <article className={`ai-v2-live-member-card ${item.user_id === user.id ? "is-me" : ""}`} key={item.process_id || `${item.user_id}-${item.started_at}`}>
                          <img src={avatarSrc(item.avatar)} alt=""/>
                          <div className="ai-v2-live-member-main">
                            <div className="ai-v2-live-member-name"><strong>{item.nickname}</strong>{item.user_id === user.id && <em>ME</em>}<span>● 진행 중</span><small>#{String(item.process_id || "").slice(0,6).toUpperCase()}</small></div>
                            <div className="ai-v2-live-member-profit">
                              <b className={Number(item.total_profit || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.total_profit || 0)}</b>
                              <small className={Number(item.total_return || 0) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.total_return || 0)}</small>
                            </div>
                            <div className="ai-v2-live-member-meta">
                              <span>{item.last_asset_name || "시장 분석 중"}{item.last_market_pct != null ? ` ${aiSignedPct(item.last_market_pct)}` : ""}</span>
                              <time>{aiTime(item.updated_at)}</time>
                            </div>
                          </div>
                          {profile?.role === "admin" && <button type="button" className="ai-v2-stop" onClick={() => adminStopAiProcess(item.process_id)}>종료</button>}
                        </article>
                      ))}
                    </div>
                  ) : <div className="ai-v2-live-empty">현재 진행 중인 AI PROCESS 회원이 없습니다.</div>}
                </section>

                {aiSimError && <div className="ai-v2-error">{aiSimError}</div>}

                <div className="ai-v2-workspace">
                  <section className="ai-v2-panel ai-v2-chart-panel">
                    <div className="ai-v2-panel-head">
                      <div>
                        <span>PERFORMANCE</span>
                        <strong>AI PROCESS 자산 변화</strong>
                      </div>
                      <button type="button" onClick={updateAiSimulation} disabled={aiSimLoading}>{aiSimLoading ? "분석 중" : "지금 갱신"}</button>
                    </div>

                    <div className="ai-v2-chart-kpis">
                      <div><span>현재</span><b>{aiSession?.status === "running" ? aiKrw(aiSession?.current_amount || aiCurrentStartMoney) : "-"}</b></div>
                      <div><span>시작</span><b>{aiSession?.status === "running" ? aiKrw(aiCurrentStartMoney) : "-"}</b></div>
                      <div><span>5분 연동</span><b>{aiLastResult ? `${aiLastResult.name} ${aiSignedPct(aiLastResult.intervalPct)}` : "대기 중"}</b></div>
                    </div>

                    <div className="ai-v2-chart-wrap">
                      {aiChart.nodes.length > 1 ? (
                        <svg viewBox={`0 0 ${aiChart.width} ${aiChart.height}`} role="img" aria-label="AI PROCESS 누적 자산 그래프">
                          <defs>
                            <linearGradient id="aiV2Area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#5fd1a0" stopOpacity=".34"/>
                              <stop offset="100%" stopColor="#5fd1a0" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          {[60,120,180,240].map((y) => <line key={y} x1="52" y1={y} x2="866" y2={y} className="ai-v2-grid-line"/>)}
                          <line x1="52" y1={aiChart.baselineY} x2="866" y2={aiChart.baselineY} className="ai-v2-baseline"/>
                          {aiChart.areaPath && <path d={aiChart.areaPath} fill="url(#aiV2Area)"/>}
                          <polyline points={aiChart.points} className="ai-v2-performance-line"/>
                          {aiChart.nodes.slice(-24).map((node, index) => (
                            <circle
                              key={`${node.at || index}-${index}`}
                              cx={node.x}
                              cy={node.y}
                              r={node.delta ? 5.2 : 3.2}
                              className={Number(node.delta || 0) < 0 ? "ai-v2-point is-loss" : Number(node.delta || 0) > 0 ? "ai-v2-point is-profit" : "ai-v2-point"}
                            >
                              <title>{`${aiTime(node.at)} · ${node.name || "AI PROCESS"} · ${aiSignedKrw(node.delta || 0)} · ${aiKrw(node.value)}`}</title>
                            </circle>
                          ))}
                        </svg>
                      ) : (
                        <div className="ai-v2-chart-empty">첫 5분 시장 구간을 기록하고 있습니다.</div>
                      )}
                      <div className="ai-v2-chart-scale ai-v2-chart-scale-top">{aiKrw(aiChart.max)}</div>
                      <div className="ai-v2-chart-scale ai-v2-chart-scale-bottom">{aiKrw(aiChart.min)}</div>
                      <div className="ai-v2-start-line-label">시작금액 기준</div>
                    </div>
                  </section>

                  <section className="ai-v2-panel ai-v2-market-panel">
                    <div className="ai-v2-panel-head">
                      <div><span>실시간 시장</span><strong>5분 시장 현황</strong></div>
                      <div className="ai-v2-market-count">8 ASSETS</div>
                    </div>
                    <div className="ai-v2-market-grid">
                      {aiMarketRows.length ? aiMarketRows.map((item) => {
                        const pct = Number(item.changePct || 0);
                        return (
                          <div className="ai-v2-market-row" key={item.symbol}>
                            <div className={`ai-v2-asset-icon ${item.type === "crypto" ? "crypto" : "stock"}`}>{item.type === "crypto" ? "◆" : "●"}</div>
                            <div className="ai-v2-market-name"><strong>{item.name}</strong><span>{item.symbol}</span></div>
                            <div className="ai-v2-market-price"><strong>{aiFormatMarketPrice(item)}</strong><span className={pct > 0 ? "is-profit" : pct < 0 ? "is-loss" : ""}>{pct > 0 ? "▲ " : pct < 0 ? "▼ " : ""}{aiSignedPct(pct)}</span></div>
                          </div>
                        );
                      }) : <div className="ai-v2-market-empty">시장 데이터를 불러오는 중입니다.</div>}
                    </div>
                  </section>
                </div>

                <section className="ai-v2-panel ai-v2-log-panel">
                  <div className="ai-v2-panel-head">
                    <div><span>운용 기록</span><strong>최근 AI PROCESS 연동 기록</strong></div>
                    <div className="ai-v2-history-count">최근 {aiRecentResults.length}건</div>
                  </div>
                  <div className="ai-v2-history-list">
                    {aiRecentResults.length ? aiRecentResults.map((item, index) => (
                      <div className="ai-v2-history-row" key={`${item.at}-${item.symbol}-${index}`}>
                        <div className={`ai-v2-history-sign ${item.resultType === "loss" || Number(item.intervalProfit) < 0 ? "is-loss" : "is-profit"}`}>{item.resultType === "loss" || Number(item.intervalProfit) < 0 ? "−" : "+"}</div>
                        <div className="ai-v2-history-asset"><strong>{item.name}</strong><span>{item.symbol} · {item.type === "crypto" ? "CRYPTO" : "STOCK"}</span></div>
                        <div className="ai-v2-history-market"><span>실제 5분</span><strong className={Number(item.intervalPct) >= 0 ? "is-profit" : "is-loss"}>{aiSignedPct(item.intervalPct)}</strong></div>
                        <div className="ai-v2-history-result"><span>AI PROCESS</span><strong className={Number(item.intervalProfit) >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(item.intervalProfit)}</strong></div>
                        <div className="ai-v2-history-balance"><span>반영 후</span><strong>{aiKrw(item.portfolioValue)}</strong></div>
                        <time>{aiTime(item.at)}</time>
                      </div>
                    )) : (
                      <div className="ai-v2-history-empty">시장 연결 후 5분 스냅샷마다 연동 종목과 누적 손익이 기록됩니다.</div>
                    )}
                  </div>
                </section>

                <div className="ai-v2-disclaimer">
                  <b>연동 기준</b> · 실제 5분 시장 움직임을 기준으로 연동 종목을 선택하고, 현재금액은 서버에서 1분 단위로 갱신합니다. 연동기록은 5분 스냅샷 1건으로 압축 저장되며 실제 주문·체결 내역을 의미하지 않습니다.
                </div>
              </div>
            )}

            {chatTab === "private" && (
              <div style={styles.refPrivateScreen}>
                {profile?.role === "admin" && !selectedAdminChat ? (
                  <>
                    <div style={styles.refSectionTitle}>
                      <div><strong>1:1 상담 목록</strong><span>VIP 회원 문의</span></div>
                    </div>
                    <input value={memberSearch} onChange={(e)=>setMemberSearch(e.target.value)} placeholder="회원 검색" style={styles.refSearch}/>
                    <div style={styles.refConsultList}>
                      {adminMembers
                        .filter(m => !memberSearch || (m.nickname || "").toLowerCase().includes(memberSearch.toLowerCase()))
                        .map(member => (
                          <button key={member.member_id} type="button" onClick={()=>openAdminMemberChat(member)} style={styles.refConsultRow}>
                            <img
                              src={avatarSrc(member.avatar)}
                              alt=""
                              style={styles.refConsultAvatar}
                            />
                            <div><strong>{member.nickname}</strong><span>1:1 상담 시작하기</span></div>
                            <b>›</b>
                          </button>
                        ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.refPrivateTop}>
                      {profile?.role === "admin" && <button type="button" onClick={()=>{setSelectedAdminChat(null);setPrivateChatId(null);}}>‹</button>}
                      <img
                        src={profile?.role === "admin"
                          ? avatarSrc(selectedAdminChat?.member?.avatar || selectedAdminChat?.avatar)
                          : avatarSrc(adminIdentity.avatar)}
                        alt="관리자 프로필"
                        style={styles.refSupportAvatar}
                      />
                      <div style={styles.refSupportInfo}>
                        {profile?.role === "admin" ? (
                          <>
                            <strong>{selectedAdminChat?.member?.nickname || selectedAdminChat?.nickname || "회원 상담"}</strong>
                            <span>VIP 전용 1:1 문의 · <b>온라인</b></span>
                          </>
                        ) : (
                          <span style={{fontSize:"15px",fontWeight:"900",color:"#34251d"}}>VIP 전용 1:1 문의 · <b>온라인</b></span>
                        )}
                      </div>
                    </div>
                    <div ref={privateMessagesRef} style={styles.refPrivateMessages}>
                      {profile?.role !== "admin" && (
                        <section className="vip-private-intro vip-private-intro-in-chat" style={{margin:"2px 0 18px",flexShrink:0}}>
                          <div className="vip-private-chip">VIP MEMBERSHIP</div>
                          <h3>VIP 회원님, 환영합니다. <span>♛</span></h3>
                          <p>1:1 문의는 이 채팅에서 편하게 남겨주세요. 이벤트 당첨 상품과 주요 안내도 이곳으로 전달됩니다.</p>
                          <div className="vip-private-event">
                            <b>🎁 VIP 이용 안내</b>
                            <span>이벤트 당첨 시 기프티콘과 상세 안내가 이 채팅에 자동으로 지급됩니다.</span>
                          </div>
                          <div className="vip-private-shortcuts">
                            <button type="button" onClick={() => setChatTab("group")}>💬 <b>그룹채팅</b></button>
                            <button type="button" onClick={() => setChatTab("event")}>🎁 <b>이벤트</b></button>
                          </div>
                          {!pushEnabled && (
                            <button type="button" className="vip-private-alert" onClick={enablePrivateNotifications}>🔔 <span><b>알림 켜기</b><small>당첨 및 1:1 답변 알림을 받을 수 있습니다.</small></span></button>
                          )}
                        </section>
                      )}
                      {privateMessages.length === 0 ? (
                        <div style={styles.refEmpty}>궁금한 내용을 남겨주세요.<br/>관리자가 확인 후 답변드립니다.</div>
                      ) : privateMessages.map(item => {
                        const mine = item.sender_id === user.id;
                        return (
                          <div key={item.id} style={{...styles.refMsgRow,justifyContent:mine?"flex-end":"flex-start"}}>
                            {!mine && (
                              <img
                                src={profile?.role === "admin"
                                  ? avatarSrc(selectedAdminChat?.member?.avatar || selectedAdminChat?.avatar)
                                  : avatarSrc(adminIdentity.avatar)}
                                alt=""
                                style={styles.refMsgAvatar}
                              />
                            )}
                            <div style={{maxWidth:"78%"}}>
                              {!mine && (
                                <div style={styles.refMsgName}>
                                  {profile?.role === "admin"
                                    ? (selectedAdminChat?.member?.nickname || selectedAdminChat?.nickname || memberNames[item.sender_id] || "VIP 회원")
                                    : (memberNames[item.sender_id] || adminIdentity.nickname || "관리자")}
                                </div>
                              )}
                              <div style={{display:"flex",gap:"6px",alignItems:"flex-end",flexDirection:mine?"row-reverse":"row"}}>
                                <div style={{...styles.refBubble,...(mine?styles.refMyBubble:styles.refOtherBubble)}}>{renderMessageContent(item.content)}</div>
                                <span style={styles.refMsgTime}>{formatChatTime(item.created_at)}</span>
                                {profile?.role === "admin" && <button type="button" onClick={()=>adminDeletePrivateMessage(item.id)} style={styles.refDelete}>×</button>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={privateBottomRef} style={{height:"1px",width:"100%"}} />
                    </div>
                    <form onSubmit={sendPrivateMessage} style={styles.refComposer}>
                      <label style={styles.refPlus}>+<input type="file" accept="image/*" hidden onChange={(e)=>uploadChatImage(e.target.files?.[0],"private")}/></label>
                      <div ref={privateEmojiRef} style={styles.refEmojiWrap}>
                        <button
                          type="button"
                          onClick={() => setShowPrivateEmoji((v) => !v)}
                          style={styles.refEmojiButton}
                          aria-label="이모티콘"
                        >
                          ☺
                        </button>
                        {showPrivateEmoji && (
                          <div style={styles.refEmojiPanel}>
                            {CHAT_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                style={styles.refEmojiItem}
                                onClick={() => {
                                  setPrivateMessage((prev) => `${prev}${emoji}`);
                                  setShowPrivateEmoji(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <textarea
                        value={privateMessage}
                        onChange={(e)=>setPrivateMessage(e.target.value)}
                        onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendPrivateMessage(e);}}}
                        placeholder="메시지를 입력하세요..."
                        style={styles.refInput}
                      />
                      <button type="submit" style={styles.refSend}>➤</button>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.luxLoginHero}>
          <div style={styles.luxGlowOne}></div>
          <div style={styles.luxGlowTwo}></div>
          <div style={styles.luxCrown}>♛</div>
          <div style={styles.goldLabel}>AI PROCESS</div>
          <h1 style={styles.title}>VIP PRIVATE</h1>
          <p style={styles.description}>AI와 함께하는 프라이빗 VIP 커뮤니티</p>
          <div style={styles.luxMascotFrame}>
            <div style={styles.luxMascotRing}></div>
            <img src="/avatars/40/profile-01.jpg" alt="AI PROCESS VIP" style={styles.luxMascotImage}/>
            <div style={styles.luxVipSeal}>VIP</div>
          </div>
          <div style={styles.luxHeroCaption}>PRIVATE · PREMIUM · COMMUNITY</div>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setNotice("");
            }}
            style={{
              ...styles.tab,
              ...(mode === "login"
                ? styles.activeTab
                : {}),
            }}
          >
            로그인
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setNotice("");
            }}
            style={{
              ...styles.tab,
              ...(mode === "signup"
                ? styles.activeTab
                : {}),
            }}
          >
            가입 신청
          </button>
        </div>

        <form
          onSubmit={
            mode === "login"
              ? handleLogin
              : handleSignup
          }
          style={styles.form}
        >
          <label style={styles.label}>닉네임</label>

          <input
            value={nickname}
            onChange={(e) =>
              setNickname(e.target.value)
            }
            style={styles.input}
            placeholder={
              mode === "login"
                ? "가입한 닉네임"
                : "채팅에서 사용할 닉네임"
            }
          />

          {mode === "signup" && (
            <>
              <label style={styles.label}>
                성함
              </label>

              <input
                value={realName}
                onChange={(e) =>
                  setRealName(e.target.value)
                }
                style={styles.input}
                placeholder="성함"
              />
            </>
          )}

          <label style={styles.label}>
            비밀번호
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            style={styles.input}
            placeholder={
              mode === "signup"
                ? "6자리 이상"
                : "비밀번호"
            }
          />

          <button
            type="submit"
            disabled={working}
            style={styles.primary}
          >
            {working
              ? "처리 중..."
              : mode === "login"
                ? "VIP 로그인"
                : "가입 신청하기"}
          </button>
        </form>

        {notice && (
          <div style={styles.notice}>
            {notice}
          </div>
        )}

        <div style={styles.footer}>
          안전한 커뮤니티 · AI 투자 프로세스 · 다양한 이벤트
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 12% 8%, rgba(225,178,105,.28) 0%, transparent 27%), radial-gradient(circle at 88% 12%, rgba(123,77,48,.18) 0%, transparent 30%), linear-gradient(145deg,#f8efe2 0%,#ead8c2 46%,#f7ead8 100%)",
    color: "#2c211c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  card: {
    width: "100%",
    maxWidth: "430px",
    background: "rgba(255,250,242,.94)",
    border: "1px solid rgba(133,91,52,.22)",
    borderRadius: "24px",
    padding: "32px 28px",
  },

  logo: {
    width: "60px",
    height: "60px",
    border: "1px solid #b38b42",
    borderRadius: "50%",
    margin: "0 auto 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9b692d",
    fontWeight: "800",
  },

  goldLabel: {
    color: "#a98a4b",
    fontSize: "10px",
    letterSpacing: "3px",
    textAlign: "center",
  },

  title: {
    textAlign: "center",
    fontSize: "30px",
    margin: "8px 0",
  },

  description: {
    color: "#888",
    textAlign: "center",
    lineHeight: "1.7",
    fontSize: "14px",
    marginBottom: "25px",
  },

  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "5px",
    background: "rgba(255,255,255,.72)",
    padding: "5px",
    borderRadius: "11px",
    marginBottom: "22px",
  },

  tab: {
    border: 0,
    background: "transparent",
    color: "#777",
    padding: "11px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
  },

  activeTab: {
    background: "linear-gradient(135deg,#fffaf1,#f1dfc6)",
    color: "#9b692d",
  },

  form: {
    display: "flex",
    flexDirection: "column",
  },

  label: {
    fontSize: "12px",
    color: "#999",
    margin: "0 0 7px 3px",
  },

  input: {
    boxSizing: "border-box",
    width: "100%",
    background: "rgba(255,255,255,.72)",
    color: "#2d211b",
    border: "1px solid rgba(116,79,48,.20)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "15px",
    outline: "none",
    fontSize: "16px",
    touchAction: "manipulation",
  },

  primary: {
    background:
      "linear-gradient(135deg, #a77b30 0%, #dfba63 50%, #9b7029 100%)",
    color: "#080808",
    border: 0,
    borderRadius: "10px",
    padding: "14px",
    fontWeight: "800",
    cursor: "pointer",
  },

  notice: {
    marginTop: "17px",
    background: "#fff8ec",
    border: "1px solid #e0c49a",
    color: "#9b692d",
    borderRadius: "9px",
    padding: "12px",
    fontSize: "12px",
    textAlign: "center",
  },

  footer: {
    color: "#444",
    textAlign: "center",
    fontSize: "9px",
    letterSpacing: "2px",
    marginTop: "26px",
  },

  chatBox: {
    width: "100%",
    maxWidth: "760px",
    height: "820px",
    maxHeight: "94vh",
    background: "rgba(248,239,226,.96)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(112,75,48,.18)",
    borderRadius: "20px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  chatHeader: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(135deg,#2b2421,#171716)",
    color: "#fff8ee",
  },

  chatTitle: {
    margin: "5px 0 0",
    fontSize: "20px",
  },

  logout: {
    background: "transparent",
    color: "#888",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "8px 11px",
    cursor: "pointer",
  },

  memberBar: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "13px 22px",
    borderBottom: "1px solid rgba(148,184,255,.12)",
  },

  memberSmall: {
    color: "#666",
    fontSize: "9px",
    marginBottom: "2px",
  },

  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "18px 16px 22px",
    scrollBehavior: "auto",
    background: "radial-gradient(circle at 88% 8%,rgba(189,141,81,.16),transparent 26%),linear-gradient(180deg,#3a2d27,#2f2724)",
  },

  empty: {
    color: "#666",
    textAlign: "center",
    marginTop: "120px",
    lineHeight: "1.8",
  },

  crown: {
    color: "#b68e45",
    fontSize: "30px",
    marginBottom: "10px",
  },

  messageRow: {
    display: "flex",
    marginBottom: "14px",
  },

  messageName: {
    display: "inline-flex",
    alignItems: "center",
    color: "#f4d27a",
    fontSize: "12px",
    margin: "0 5px 6px",
    fontWeight: "900",
    letterSpacing: "0.25px",
    textShadow: "0 1px 10px rgba(244,210,122,.22)",
    background: "rgba(216,178,92,.10)",
    border: "1px solid rgba(216,178,92,.18)",
    borderRadius: "999px",
    padding: "3px 8px",
  },

  privateAvatar: {
    width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", flexShrink: 0,
    border: "1px solid rgba(216,178,92,.35)", boxShadow: "0 4px 14px rgba(0,0,0,.25)",
  },

  kakaoNickname: {
    fontSize: "13px",
    fontWeight: "800",
    color: "#e8edf5",
    lineHeight: 1.2,
    paddingLeft: "2px",
  },

  chatTime: {
    fontSize: "10px",
    fontWeight: "600",
    color: "rgba(220,228,240,.56)",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    paddingBottom: "2px",
    flexShrink: 0,
  },

  adminDeleteButton: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "1px solid rgba(255,74,74,.55)",
    background: "rgba(255,45,45,.14)",
    color: "#ff5d5d",
    fontSize: "17px",
    fontWeight: "900",
    lineHeight: "18px",
    cursor: "pointer",
    flexShrink: 0,
  },

  chatToolRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    marginRight: "4px",
  },

  chatToolButton: {
    width: "38px",
    height: "38px",
    borderRadius: "11px",
    border: "1px solid rgba(216,178,92,.24)",
    background: "rgba(255,255,255,.06)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "19px",
    flexShrink: 0,
  },

  emojiPanel: {
    position: "absolute",
    left: 0,
    bottom: "46px",
    width: "260px",
    padding: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    background: "#101d31",
    border: "1px solid rgba(216,178,92,.32)",
    borderRadius: "14px",
    boxShadow: "0 14px 34px rgba(0,0,0,.38)",
    zIndex: 50,
  },

  emojiButton: {
    width: "34px",
    height: "34px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "21px",
  },

  freezeAdminBar: {
    margin: "10px 14px 0", padding: "11px 12px", borderRadius: "13px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
    background: "rgba(10,20,40,.88)", border: "1px solid rgba(255,255,255,.10)",
  },
  freezeAdminHint: {fontSize:"11px",color:"#9aa8bf",marginTop:"3px"},
  freezeButton: {border:0,borderRadius:"10px",padding:"9px 12px",background:"#a52a35",color:"#fff",fontWeight:"900",cursor:"pointer"},
  unfreezeButton: {border:0,borderRadius:"10px",padding:"9px 12px",background:"#1f8b62",color:"#fff",fontWeight:"900",cursor:"pointer"},
  frozenBanner: {margin:"10px 14px 0",padding:"11px 12px",borderRadius:"12px",textAlign:"center",fontSize:"13px",fontWeight:"800",color:"#ffd9dd",background:"rgba(130,24,36,.28)",border:"1px solid rgba(255,100,115,.28)"},
  frozenTextarea: {opacity:.55,cursor:"not-allowed"},

  bubble: {
    maxWidth: "520px",
    padding: "11px 14px",
    borderRadius: "13px",
    fontSize: "14px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  myBubble: {
    background: "#332816",
    border: "1px solid #594522",
    color: "#f0d594",
  },

  otherBubble: {
    background: "#191919",
    border: "1px solid rgba(116,79,48,.20)",
    color: "#ddd",
  },

  chatNotice: {
    color: "#9b692d",
    background: "#fff8ec",
    padding: "8px 20px",
    fontSize: "11px",
  },

  sendArea: {
    borderTop: "1px solid #282116",
    padding: "14px",
    display: "flex",
    gap: "10px",
  },

  textarea: {
    flex: 1,
    resize: "none",
    background: "rgba(255,255,255,.72)",
    color: "#fff",
    border: "1px solid rgba(116,79,48,.20)",
    borderRadius: "10px",
    padding: "12px",
    outline: "none",
    fontFamily: "inherit",
  },

  sendButton: {
    width: "85px",
    background: "#c49a4b",
    color: "#080808",
    border: 0,
    borderRadius: "10px",
    fontWeight: "800",
    cursor: "pointer",
  },

  avatarButton: {
    width: "44px",
    height: "44px",
    padding: 0,
    borderRadius: "50%",
    border: "2px solid #b68e45",
    background: "#111",
    overflow: "hidden",
    cursor: "pointer",
    flexShrink: 0,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  avatarPicker: {
    margin: "12px 22px",
    padding: "16px",
    borderRadius: "15px",
    border: "1px solid rgba(133,91,52,.22)",
    background: "#121212",
  },

  avatarPickerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },

  avatarClose: {
    background: "transparent",
    color: "#888",
    border: 0,
    cursor: "pointer",
    fontSize: "17px",
  },

  avatarGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(6, minmax(0, 1fr))",
    gap: "10px",
  },

  avatarChoice: {
    padding: "3px",
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    border: "2px solid transparent",
    background: "#191919",
    overflow: "hidden",
    cursor: "pointer",
  },

  avatarChoiceSelected: {
    border: "2px solid #d8b25c",
  },

  avatarChoiceImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },

  avatarPickerText: {
    marginTop: "12px",
    color: "#777",
    fontSize: "11px",
  },

  eventPage: {
    flex: 1,
    overflowY: "auto",
    padding: "22px",
  },

  eventTop: {
    padding: "22px",
    borderRadius: "18px",
    border: "1px solid #4a391b",
    background:
      "linear-gradient(120deg, #111416 0%, #111416 58%, #2a2110 100%)",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
  },

  eventMiniTitle: {
    color: "#9b692d",
    fontSize: "10px",
    letterSpacing: "3px",
    fontWeight: "800",
  },

  eventTitle: {
    marginTop: "9px",
    fontSize: "25px",
    fontWeight: "900",
  },

  eventDescription: {
    marginTop: "8px",
    color: "#999",
    fontSize: "13px",
    lineHeight: "1.6",
  },

  eventLiveBadge: {
    color: "#e2bd65",
    border: "1px solid #7a5b20",
    background: "#1d170b",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "10px",
    fontWeight: "900",
    whiteSpace: "nowrap",
  },

  eventNoticeBox: {
    marginTop: "14px",
    padding: "15px 17px",
    borderRadius: "14px",
    border: "1px solid rgba(116,79,48,.20)",
    background: "#121518",
    display: "flex",
    alignItems: "center",
    gap: "13px",
  },

  eventNoticeIcon: {
    fontSize: "25px",
  },

  eventNoticeTitle: {
    fontSize: "14px",
    fontWeight: "900",
  },

  eventNoticeText: {
    marginTop: "4px",
    color: "#858585",
    fontSize: "11px",
    lineHeight: "1.6",
  },

  eventNoticeMessage: {
    marginTop: "12px",
    padding: "11px 13px",
    borderRadius: "10px",
    border: "1px solid #49391c",
    background: "#fff8ec",
    color: "#e0bb65",
    fontSize: "12px",
  },

  eventSectionTitle: {
    margin: "20px 2px 10px",
    color: "#777",
    fontSize: "10px",
    letterSpacing: "2px",
    fontWeight: "900",
  },

  eventGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(270px, 1fr))",
    gap: "12px",
  },

  eventCard: {
    minWidth: 0,
    padding: "16px",
    background: "linear-gradient(145deg,rgba(20,38,67,.90),rgba(11,25,48,.92))",
    border: "1px solid rgba(132,174,255,.18)",
    borderRadius: "15px",
    color: "#fff",
    display: "flex",
    gap: "13px",
    textAlign: "left",
  },

  eventCardActive: {
    border: "1px solid #a47b2d",
    boxShadow:
      "0 0 0 1px rgba(216,178,92,.08)",
  },

  eventIconBox: {
    width: "48px",
    height: "48px",
    borderRadius: "13px",
    background: "#1b1e21",
    border: "1px solid #303438",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "23px",
    flexShrink: 0,
  },

  eventCardBody: {
    flex: 1,
    minWidth: 0,
  },

  eventRound: {
    color: "#8d8d8d",
    fontSize: "10px",
    marginBottom: "5px",
  },

  eventCardTitle: {
    fontWeight: "900",
    fontSize: "15px",
  },

  eventCardText: {
    marginTop: "5px",
    color: "#808080",
    fontSize: "11px",
    lineHeight: "1.5",
  },

  eventCardBottom: {
    marginTop: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  eventReady: {
    color: "#777",
    fontSize: "11px",
    fontWeight: "800",
  },

  eventActiveText: {
    color: "#65d99c",
    fontSize: "11px",
    fontWeight: "900",
  },

  eventDoneText: {
    color: "#777",
    fontSize: "11px",
    fontWeight: "800",
  },

  eventJoinButton: {
    border: "1px solid #8a6727",
    background:
      "linear-gradient(135deg,#b88932,#e3bd61)",
    color: "#080808",
    borderRadius: "8px",
    padding: "7px 11px",
    fontSize: "11px",
    fontWeight: "900",
    cursor: "pointer",
  },

  eventJoinedButton: {
    background: "#18251f",
    color: "#65d99c",
    border: "1px solid #28563d",
    cursor: "default",
  },

  eventWinner: {
    color: "#e0ba60",
    fontSize: "11px",
    fontWeight: "900",
  },

  eventNext: {
    color: "#666",
    fontSize: "10px",
  },

  eventEmpty: {
    gridColumn: "1 / -1",
    padding: "60px 20px",
    color: "#666",
    textAlign: "center",
    border: "1px dashed #292929",
    borderRadius: "15px",
  },

  aiPage: {
    flex: 1,
    overflowY: "auto",
    padding: "18px",
    background: "linear-gradient(180deg,rgba(10,24,48,.78),rgba(7,17,33,.92))",
  },

  aiHero: {
    position: "relative",
    overflow: "hidden",
    padding: "24px",
    minHeight: "90px",
    borderRadius: "18px",
    border: "1px solid rgba(121,163,255,.28)",
    background:
      "radial-gradient(circle at 88% 45%, rgba(74,122,255,.36) 0%, rgba(20,44,83,.45) 30%, rgba(12,28,52,.94) 70%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },

  aiHeroLabel: {
    color: "#e0b951",
    fontSize: "9px",
    letterSpacing: "3px",
    fontWeight: "900",
  },

  aiHeroTitle: {
    marginTop: "9px",
    color: "#f3f3ef",
    fontSize: "27px",
    fontWeight: "900",
  },

  aiHeroText: {
    marginTop: "7px",
    color: "#999",
    fontSize: "11px",
    lineHeight: "1.6",
  },

  aiHeroDiamond: {
    color: "#4da3ff",
    fontSize: "44px",
    textShadow:
      "0 0 20px rgba(77,163,255,.45)",
    paddingRight: "10px",
  },

  aiMenu: {
    marginTop: "12px",
    padding: "7px",
    background: "#101418",
    border: "1px solid #292d31",
    borderRadius: "13px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "7px",
  },

  aiMenuButton: {
    border: 0,
    borderRadius: "9px",
    padding: "11px",
    background: "transparent",
    color: "#81878c",
    cursor: "pointer",
    fontWeight: "800",
  },

  aiMenuActive: {
    color: "#111",
    background:
      "linear-gradient(135deg,#d39c36,#f0c75e)",
    boxShadow:
      "0 4px 15px rgba(213,160,55,.18)",
  },

  aiNotice: {
    marginTop: "12px",
    padding: "10px 13px",
    background: "#fff8ec",
    border: "1px solid #44361c",
    color: "#9b692d",
    borderRadius: "10px",
    fontSize: "11px",
  },

  aiPanel: {
    marginTop: "13px",
    padding: "19px",
    background: "rgba(14,31,56,.86)",
    border: "1px solid #2b3035",
    borderTop: "2px solid #9e762a",
    borderRadius: "16px",
  },

  aiPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },

  aiPanelTitle: {
    color: "#eee",
    fontSize: "18px",
    fontWeight: "900",
  },

  aiPanelSub: {
    color: "#747b80",
    fontSize: "10px",
    marginTop: "5px",
  },

  aiStatusButtons: {
    display: "flex",
    gap: "7px",
  },

  aiStatusButton: {
    border: "1px solid #30363b",
    borderRadius: "999px",
    background: "transparent",
    color: "#7e858b",
    padding: "7px 12px",
    fontSize: "10px",
    cursor: "pointer",
  },

  aiStatusActive: {
    border: "1px solid #9d721e",
    color: "#e4b84f",
    background: "#211a0c",
  },

  aiTradeHero: {
    display:"flex", justifyContent:"space-between", alignItems:"center", gap:"18px",
    padding:"24px", borderRadius:"20px", marginBottom:"12px",
    background:"linear-gradient(135deg,rgba(18,44,83,.98),rgba(7,18,36,.98))",
    border:"1px solid rgba(105,158,255,.22)", boxShadow:"0 16px 45px rgba(0,0,0,.22)"
  },
  aiTradeEyebrow:{fontSize:"10px",fontWeight:"900",letterSpacing:"1.8px",color:"#75a7ff",marginBottom:"7px"},
  aiTradeTitle:{fontSize:"25px",fontWeight:"950",color:"#f5f8ff",marginBottom:"7px"},
  aiTradeDesc:{fontSize:"12px",lineHeight:1.65,color:"rgba(225,234,249,.68)",maxWidth:"650px"},
  aiTradeLive:{padding:"9px 13px",borderRadius:"999px",background:"rgba(47,214,139,.10)",border:"1px solid rgba(47,214,139,.25)",color:"#61e6a3",fontSize:"12px",fontWeight:"900",whiteSpace:"nowrap"},
  aiEducationBanner:{display:"flex",gap:"10px",alignItems:"center",padding:"10px 14px",marginBottom:"14px",borderRadius:"12px",background:"rgba(246,190,68,.07)",border:"1px solid rgba(246,190,68,.18)",color:"rgba(236,241,250,.72)",fontSize:"11px"},
  aiSummaryGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"11px",marginBottom:"12px"},
  aiSummaryCard:{padding:"18px",borderRadius:"16px",background:"rgba(12,28,52,.92)",border:"1px solid rgba(255,255,255,.07)",display:"flex",flexDirection:"column",gap:"7px"},
  aiSummaryCardStrong:{padding:"18px",borderRadius:"16px",background:"linear-gradient(145deg,rgba(31,73,137,.92),rgba(14,37,73,.96))",border:"1px solid rgba(100,158,255,.25)",display:"flex",flexDirection:"column",gap:"7px"},
  aiPlusText:{color:"#57e39a",fontWeight:"950"},
  aiMinusText:{color:"#ff7474",fontWeight:"950"},
  aiMainGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"12px",marginBottom:"12px"},
  aiTradePanel:{padding:"18px",borderRadius:"20px",background:"rgba(255,250,242,.96)",border:"1px solid rgba(126,86,52,.16)",boxShadow:"0 10px 28px rgba(83,52,31,.08)",marginBottom:"12px"},
  aiSectionHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",marginBottom:"15px"},
  aiChartRatePlus:{color:"#57e39a",fontSize:"17px",fontWeight:"950"},
  aiChartRateMinus:{color:"#ff7474",fontSize:"17px",fontWeight:"950"},
  aiChartBox:{height:"190px",borderRadius:"13px",background:"linear-gradient(180deg,rgba(55,135,255,.06),rgba(0,0,0,.06))",overflow:"hidden",color:"#55d99a",display:"flex",alignItems:"center",justifyContent:"center"},
  aiSvg:{width:"100%",height:"100%",display:"block"},
  aiChartWaiting:{padding:"25px",textAlign:"center",color:"rgba(220,230,245,.48)",fontSize:"12px"},
  aiChartFooter:{display:"flex",justifyContent:"space-between",gap:"8px",marginTop:"8px",fontSize:"10px",color:"rgba(220,230,245,.45)"},
  aiCountdownBox:{fontVariantNumeric:"tabular-nums",padding:"8px 10px",borderRadius:"9px",background:"rgba(71,137,245,.11)",color:"#8bb8ff",fontWeight:"950",fontSize:"13px"},
  aiDecisionFlow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",padding:"12px 0 16px"},
  aiDurationInfo:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"8px"},
  aiManualRefresh:{border:"1px solid rgba(91,153,255,.28)",background:"rgba(58,120,220,.12)",color:"#cfe0ff",padding:"8px 11px",borderRadius:"9px",fontSize:"11px",fontWeight:"850",cursor:"pointer"},
  aiEmptyInvest:{padding:"28px",textAlign:"center",borderRadius:"13px",background:"rgba(255,255,255,.025)",color:"rgba(220,230,245,.55)",fontSize:"12px"},
  aiHoldingGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"10px"},
  aiHoldingCard:{padding:"16px",borderRadius:"15px",background:"linear-gradient(145deg,rgba(19,44,80,.8),rgba(8,22,42,.9))",border:"1px solid rgba(90,150,250,.14)"},
  aiHoldingTop:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px",marginBottom:"12px"},
  aiCoinBadge:{fontSize:"9px",fontWeight:"950",letterSpacing:".8px",padding:"5px 7px",borderRadius:"7px",background:"rgba(245,184,64,.10)",color:"#f1c464"},
  aiStockBadge:{fontSize:"9px",fontWeight:"950",letterSpacing:".8px",padding:"5px 7px",borderRadius:"7px",background:"rgba(81,145,255,.11)",color:"#83b1ff"},
  aiBuyingBadge:{fontSize:"9px",fontWeight:"900",padding:"5px 7px",borderRadius:"999px",background:"rgba(52,211,135,.09)",color:"#61df9e"},
  aiHoldingName:{fontSize:"17px",fontWeight:"950",color:"#f3f7ff"},
  aiHoldingSymbol:{fontSize:"10px",color:"rgba(210,223,243,.45)",marginTop:"3px",marginBottom:"14px"},
  aiHoldingBottom:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",paddingTop:"11px",borderTop:"1px solid rgba(255,255,255,.06)"},
  aiActivityList:{display:"flex",flexDirection:"column",gap:"8px"},
  aiActivityRow:{display:"flex",alignItems:"center",gap:"10px",padding:"10px",borderRadius:"11px",background:"rgba(255,255,255,.025)"},
  aiActivityBuy:{minWidth:"38px",textAlign:"center",fontSize:"9px",fontWeight:"950",padding:"5px",borderRadius:"6px",background:"rgba(48,211,135,.10)",color:"#58df98"},
  aiActivitySell:{minWidth:"38px",textAlign:"center",fontSize:"9px",fontWeight:"950",padding:"5px",borderRadius:"6px",background:"rgba(255,92,92,.09)",color:"#ff8585"},
  aiActivityAnalyze:{minWidth:"38px",textAlign:"center",fontSize:"9px",fontWeight:"950",padding:"5px",borderRadius:"6px",background:"rgba(75,139,245,.10)",color:"#8cb8ff"},
  aiExplainList:{display:"flex",flexDirection:"column",gap:"9px"},
  aiDisclaimer:{padding:"13px 15px",borderRadius:"12px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.05)",color:"rgba(213,224,242,.48)",fontSize:"10px",lineHeight:1.6,marginBottom:"10px"},
  aiErrorBox:{padding:"16px",borderRadius:"12px",background:"rgba(255,70,70,.07)",color:"#ffaaaa",fontSize:"12px"},

  aiProcessGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "10px",
    marginTop: "15px",
  },

  aiProcessCard: {
    padding: "15px",
    borderRadius: "13px",
    border: "1px solid #2a3035",
    background: "#0d1114",
  },

  aiProcessTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },

  aiProcessRound: {
    color: "#4da3ff",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "1px",
  },

  aiProcessName: {
    marginTop: "5px",
    fontWeight: "900",
    fontSize: "14px",
  },

  aiProcessReady: {
    padding: "5px 8px",
    borderRadius: "999px",
    border: "1px solid #343a40",
    color: "#777f85",
    fontSize: "9px",
  },

  aiProcessInfo: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },

  aiProcessInfo: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },

  aiMoneyGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "15px",
  },

  aiMoneyCard: {
    padding: "16px",
    background: "#0d1114",
    border: "1px solid #2a3035",
    borderRadius: "13px",
  },

  aiMoneyLabel: {
    color: "#7e858b",
    fontSize: "10px",
  },

  aiMoneyGreen: {
    marginTop: "8px",
    color: "#53dfa4",
    fontSize: "21px",
    fontWeight: "900",
  },

  aiMoneyWhite: {
    marginTop: "8px",
    color: "#f0f0ed",
    fontSize: "21px",
    fontWeight: "900",
  },

  aiChartBox: {
    marginTop: "10px",
    minHeight: "190px",
    padding: "15px",
    background: "#0d1114",
    border: "1px solid #2a3035",
    borderRadius: "13px",
  },

  aiChartHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    color: "#e2e2df",
    fontSize: "11px",
  },

  aiChartEmpty: {
    height: "135px",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  aiChartLine: {
    position: "absolute",
    inset: "15px 0 0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    opacity: 0.25,
  },

  aiChartEmptyText: {
    position: "relative",
    zIndex: 2,
    color: "#555d62",
    fontSize: "10px",
  },

  aiLogBox: {
    marginTop: "10px",
    padding: "15px",
    background: "#0d1114",
    border: "1px solid #2a3035",
    borderRadius: "13px",
  },

  aiLogEmpty: {
    color: "#5f666b",
    fontSize: "10px",
    padding: "25px 0 10px",
    textAlign: "center",
  },
  gameGuide: { marginTop: "11px", padding: "10px 12px", borderRadius: "11px", background: "rgba(78,126,255,.08)", border: "1px solid rgba(115,158,255,.16)", display: "flex", flexDirection: "column", gap: "5px", color: "#cbd9f7", fontSize: "10px", lineHeight: 1.55 },
  gameArea: { marginTop: "11px", padding: "12px", borderRadius: "12px", background: "rgba(5,15,31,.62)", border: "1px solid rgba(120,163,255,.14)" },
  gameLabel: { color: "#aebfdf", fontSize: "10px", fontWeight: "800", marginBottom: "9px" },
  gameFourGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "7px" },
  gameChoice: { border: "1px solid rgba(137,169,230,.22)", background: "rgba(22,43,75,.78)", color: "#eaf1ff", borderRadius: "10px", padding: "10px 5px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", fontSize: "12px" },
  gameChoiceSelected: { border: "1px solid #78a7ff", background: "rgba(63,113,219,.30)", boxShadow: "0 0 18px rgba(75,129,255,.18)" },
  gameSubmit: { width: "100%", marginTop: "10px", border: "1px solid rgba(139,176,255,.36)", background: "linear-gradient(135deg,#4f7de8,#6c8fff)", color: "#fff", borderRadius: "10px", padding: "10px 12px", fontWeight: "900", cursor: "pointer" },
  numberRow: { display: "flex", gap: "8px" },
  gameInput: { flex: 1, minWidth: 0, background: "rgba(7,18,36,.9)", color: "#fff", border: "1px solid rgba(133,171,244,.25)", borderRadius: "10px", padding: "11px 12px", outline: "none" },
  gameSubmitSmall: { width: "78px", border: 0, borderRadius: "10px", background: "linear-gradient(135deg,#4f7de8,#6c8fff)", color: "#2d211b", fontWeight: "900", cursor: "pointer" },
  quizQuestion: { color: "#f2f6ff", fontSize: "12px", fontWeight: "900", lineHeight: 1.55, marginBottom: "9px" },
  quizGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" },
  quizChoice: { textAlign: "left", border: "1px solid rgba(137,169,230,.22)", background: "rgba(22,43,75,.78)", color: "#dce8ff", borderRadius: "10px", padding: "9px", cursor: "pointer", fontSize: "10px", lineHeight: 1.45 },
  rouletteWheel: { width: "66px", height: "66px", margin: "2px auto 8px", borderRadius: "50%", border: "5px solid rgba(124,164,255,.75)", background: "conic-gradient(#547de1 0 25%,#182f58 25% 50%,#d2aa55 50% 75%,#223f75 75% 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2d211b", fontSize: "25px", transition: "transform .9s cubic-bezier(.15,.8,.2,1)" },
  myEntry: { marginTop: "10px", padding: "8px 10px", borderRadius: "9px", background: "rgba(63,199,145,.10)", border: "1px solid rgba(83,223,164,.20)", color: "#70e2b0", fontSize: "10px", fontWeight: "800" },
  resultReveal: { marginTop: "9px", padding: "8px 10px", borderRadius: "9px", background: "rgba(210,170,85,.10)", border: "1px solid rgba(210,170,85,.22)", color: "#e8c875", fontSize: "10px", fontWeight: "900" },
  eventJoinedText: { color: "#6de0ad", fontSize: "10px", fontWeight: "900" },
  eventOpenText: { color: "#91b6ff", fontSize: "10px", fontWeight: "900" },

  // 2026 reference-driven app UI
  brandWrap: {display:"flex",alignItems:"center",gap:"10px"},
  brandAvatar: {width:"38px",height:"38px",borderRadius:"12px",display:"grid",placeItems:"center",fontSize:"24px",background:"#fff7e9",border:"1px solid #dfc39d",boxShadow:"0 5px 16px rgba(61,39,24,.18)"},
  brandTitle: {fontSize:"17px",fontWeight:"900",letterSpacing:".2px",color:"#fff7e9"},
  brandSub: {fontSize:"10px",color:"#cbb9a9",marginTop:"2px"},
  headerActions: {display:"flex",alignItems:"center",gap:"8px"},
  headerBell: {width:"34px",height:"34px",borderRadius:"12px",display:"grid",placeItems:"center",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)"},
  loginCrown: {fontSize:"42px",textAlign:"center",color:"#b17a35",marginBottom:"4px"},
  loginMascot: {fontSize:"78px",textAlign:"center",margin:"10px 0 18px",filter:"drop-shadow(0 10px 16px rgba(80,48,26,.16))"},

  groupEventCard: {margin:"10px 16px 0",padding:"13px 14px",display:"flex",alignItems:"center",gap:"12px",textAlign:"left",border:"1px solid #e2c89f",borderRadius:"18px",background:"linear-gradient(135deg,#fff9ee,#f5dfbe)",boxShadow:"0 8px 22px rgba(82,53,31,.09)",cursor:"pointer",color:"#34241b"},
  groupEventGift: {width:"52px",height:"52px",borderRadius:"15px",display:"grid",placeItems:"center",fontSize:"30px",background:"rgba(255,255,255,.78)"},
  groupEventCopy: {minWidth:0,flex:1,display:"flex",flexDirection:"column",gap:"2px"},
  groupEventCopySpan: {fontSize:"9px",fontWeight:"900",letterSpacing:"1px",color:"#a76d2c"},
  groupEventArrow: {width:"34px",height:"34px",borderRadius:"50%",display:"grid",placeItems:"center",fontSize:"28px",background:"#b77d35",color:"#fff"},

  featuredEventCard: {margin:"0 0 16px",padding:"18px",borderRadius:"22px",background:"linear-gradient(145deg,#3c2b25 0%,#5b4031 55%,#2f2522 100%)",color:"#fff8ef",boxShadow:"0 14px 32px rgba(66,40,25,.22)",border:"1px solid rgba(255,223,180,.18)"},
  featuredEventTop: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"},
  featuredLive: {padding:"6px 10px",borderRadius:"999px",background:"#ef5a52",fontSize:"11px",fontWeight:"900"},
  featuredSoon: {padding:"6px 10px",borderRadius:"999px",background:"#b8843e",fontSize:"11px",fontWeight:"900"},
  featuredTimer: {fontSize:"12px",color:"#e9d9c9"},
  featuredEventMain: {display:"flex",alignItems:"center",gap:"14px"},
  featuredEventIcon: {width:"64px",height:"64px",borderRadius:"18px",display:"grid",placeItems:"center",fontSize:"38px",background:"rgba(255,255,255,.09)"},
  featuredEventTitle: {fontSize:"22px",fontWeight:"900",marginBottom:"5px"},
  featuredEventDesc: {fontSize:"12px",lineHeight:"1.55",color:"#e6d6c8"},
  featuredJoin: {width:"100%",marginTop:"16px",border:0,borderRadius:"14px",padding:"13px 16px",background:"linear-gradient(90deg,#f4c775,#d99b47)",color:"#3a281d",fontWeight:"900",fontSize:"14px",display:"flex",justifyContent:"space-between",cursor:"pointer"},
  featuredJoinDisabled: {marginTop:"16px",borderRadius:"14px",padding:"12px 16px",background:"rgba(255,255,255,.08)",color:"#ddcbbd",fontWeight:"800",fontSize:"12px",textAlign:"center"},

  marketPulseCard: {padding:"20px",marginBottom:"14px",borderRadius:"22px",background:"linear-gradient(145deg,#17252b,#25363a 55%,#1c2c31)",color:"#f8f0e7",boxShadow:"0 14px 30px rgba(33,44,45,.18)",border:"1px solid rgba(255,255,255,.08)"},
  marketPulseTop: {display:"flex",alignItems:"center",justifyContent:"space-between"},
  marketPulseLabel: {display:"block",fontSize:"11px",color:"#b9c6c2",marginBottom:"5px"},
  marketPulseProfit: {display:"block",fontSize:"30px",lineHeight:1.1,color:"#ffd48c",letterSpacing:"-.5px"},
  marketRobot: {width:"76px",height:"76px",borderRadius:"22px",display:"grid",placeItems:"center",fontSize:"50px",background:"radial-gradient(circle at 50% 35%,#eafcff,#9ccbd0 70%,#5e8f95)",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.35),0 8px 20px rgba(0,0,0,.18)"},
  marketMiniStats: {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginTop:"16px"},

  refPage:{minHeight:"100vh",height:"100dvh",maxWidth:"100vw",overflow:"hidden",background:"linear-gradient(135deg,#efe4d6,#f8f0e6)",display:"flex",justifyContent:"center",alignItems:"stretch",fontFamily:"Arial, sans-serif",color:"#2b221e"},
  refApp:{width:"100%",maxWidth:"520px",minWidth:0,minHeight:0,height:"100dvh",maxHeight:"100dvh",background:"#f7efe5",boxShadow:"0 0 50px rgba(56,38,27,.16)",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",boxSizing:"border-box",touchAction:"manipulation",WebkitTextSizeAdjust:"100%"},
  refAppAi:{maxWidth:"1180px"},
  refHeader:{height:"70px",padding:"0 14px",background:"linear-gradient(135deg,#28221f,#171716)",display:"flex",alignItems:"center",justifyContent:"space-between",color:"#fff",flexShrink:0,position:"relative",zIndex:2147483646,pointerEvents:"auto"},
  refBrand:{display:"flex",alignItems:"center",gap:"9px"},
  refAvatarButton:{padding:0,border:0,background:"transparent",cursor:"pointer"},
  refAvatar:{width:"34px",height:"34px",borderRadius:"50%",objectFit:"cover",border:"2px solid #f0d3a4",boxShadow:"0 3px 10px rgba(0,0,0,.16)"},
  refBrandTitle:{fontSize:"16px",fontWeight:"900",letterSpacing:".3px"},
  refBrandSub:{fontSize:"10px",color:"#b9ada5",marginTop:"2px"},
  refHeaderRight:{display:"flex",alignItems:"center",gap:"6px",position:"relative",zIndex:2147483647,pointerEvents:"auto"},
  refBellButton:{height:"40px",minWidth:"48px",padding:"0 9px",borderRadius:"999px",border:"1px solid rgba(235,197,127,.38)",background:"rgba(255,255,255,.055)",color:"#e3cfae",display:"flex",alignItems:"center",justifyContent:"center",gap:"3px",cursor:"pointer",fontSize:"9px",fontWeight:"900",boxSizing:"border-box",position:"relative",zIndex:100000,pointerEvents:"auto",touchAction:"manipulation",WebkitTapHighlightColor:"transparent",userSelect:"none"},
  refBellButtonOn:{border:"1px solid rgba(103,222,160,.45)",background:"rgba(66,190,128,.12)",color:"#7be0ad",boxShadow:"0 0 12px rgba(66,190,128,.10)"},
  refBellIcon:{fontSize:"14px",lineHeight:1},
  refMyInfoButton:{height:"34px",padding:"3px 9px 3px 4px",borderRadius:"999px",border:"1px solid rgba(235,197,127,.38)",background:"linear-gradient(145deg,rgba(255,245,218,.12),rgba(183,123,47,.08))",color:"#f4d69b",display:"flex",alignItems:"center",gap:"6px",fontSize:"9px",fontWeight:"900",letterSpacing:".2px",cursor:"pointer",boxShadow:"inset 0 1px 0 rgba(255,255,255,.08)"},
  refMyInfoAvatar:{width:"23px",height:"23px",borderRadius:"50%",objectFit:"cover",border:"1px solid #e7bd6b",boxShadow:"0 2px 8px rgba(0,0,0,.16)"},
  refBell:{position:"relative",fontSize:"22px",color:"#d9a85e"},
  refMiniAvatar:{width:"34px",height:"34px",borderRadius:"50%",objectFit:"cover",border:"2px solid #a97a44"},
  refNav:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"5px",padding:"10px 8px 9px",background:"#211d1b",borderBottom:"1px solid rgba(255,255,255,.06)",flexShrink:0},
  refNavButton:{position:"relative",minWidth:0,height:"58px",border:"1px solid rgba(255,255,255,.06)",borderRadius:"12px",background:"#262220",color:"#c9beb6",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",fontSize:"10px",fontWeight:"800",cursor:"pointer",boxShadow:"inset 0 1px 0 rgba(255,255,255,.025)"},
  refNavButtonActive:{background:"linear-gradient(145deg,#fff9ee,#f2dfc2)",color:"#3c2b22",border:"1px solid #f3d7aa",boxShadow:"0 0 20px rgba(239,190,116,.30),inset 0 0 0 1px rgba(255,255,255,.7)"},
  refNavIcon:{fontSize:"20px",lineHeight:1},
  refNavBadge:{position:"absolute",right:"7px",top:"5px",minWidth:"17px",height:"17px",padding:"0 4px",borderRadius:"9px",background:"#ef544d",color:"#fff",fontStyle:"normal",fontSize:"9px",display:"grid",placeItems:"center"},
  refBody:{flex:"1 1 0",minHeight:0,height:"auto",display:"flex",overflow:"hidden",width:"100%",boxSizing:"border-box"},
  refScreen:{flex:"1 1 0",minHeight:0,height:"auto",maxHeight:"100%",display:"flex",flexDirection:"column",background:"linear-gradient(180deg,#40332c,#302824)",position:"relative",overflow:"hidden",boxSizing:"border-box"},
  refMemberStrip:{padding:"7px 12px",display:"flex",alignItems:"center",gap:"8px",color:"#fff7ef",borderBottom:"1px solid rgba(255,255,255,.05)",flex:"0 0 auto",boxSizing:"border-box"},
  refMemberCount:{marginLeft:"auto",width:"fit-content",maxWidth:"145px",height:"34px",padding:"0 10px",borderRadius:"999px",display:"flex",alignItems:"center",justifyContent:"flex-start",gap:"6px",background:"linear-gradient(135deg,rgba(255,246,219,.11),rgba(196,132,50,.08))",border:"1px solid rgba(236,196,119,.28)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.07),0 5px 16px rgba(0,0,0,.10)",whiteSpace:"nowrap"},
  refMemberCountIcon:{width:"22px",height:"22px",borderRadius:"50%",display:"grid",placeItems:"center",flexShrink:0,color:"#edc87e",background:"rgba(224,179,99,.10)",border:"1px solid rgba(237,200,126,.18)"},
  refMemberCountLabel:{fontSize:"6px",fontWeight:"800",letterSpacing:".75px",color:"#ad9a7e"},
  refMemberCountNumber:{fontSize:"11px",fontWeight:"950",letterSpacing:"-.2px",color:"#fff0cf"},
  refMemberStripImg:{width:"46px",height:"46px",borderRadius:"50%"},
  refLockNotice:{margin:"8px 12px 0",padding:"8px 10px",borderRadius:"10px",background:"rgba(255,240,210,.12)",color:"#f4d7a9",fontSize:"10px",textAlign:"center"},
  refAdminMini:{marginLeft:"auto",border:"1px solid rgba(255,255,255,.12)",borderRadius:"9px",background:"rgba(255,255,255,.07)",color:"#f6e6d2",padding:"6px 8px",fontSize:"9px"},
  refMessages:{flex:"1 1 0",height:0,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",padding:"8px 13px 10px",backgroundColor:"#352a25",backgroundImage:"radial-gradient(circle at 12% 12%,rgba(233,192,126,.10) 0 1px,transparent 2px),radial-gradient(circle at 86% 18%,rgba(255,230,184,.08) 0 1px,transparent 2px),linear-gradient(125deg,transparent 0 42%,rgba(211,167,104,.045) 43% 44%,transparent 45% 100%),radial-gradient(ellipse at 50% -15%,rgba(170,119,67,.18),transparent 48%),linear-gradient(180deg,#42342d 0%,#342a25 52%,#2e2622 100%)",backgroundSize:"46px 46px,64px 64px,180px 180px,100% 100%,100% 100%"},
  refDateChip:{width:"max-content",margin:"0 auto 13px",padding:"5px 10px",borderRadius:"999px",background:"rgba(255,255,255,.08)",color:"#c9bdb4",fontSize:"9px"},
  refEmpty:{margin:"40px auto",textAlign:"center",fontSize:"12px",lineHeight:1.7,color:"#a99a91"},
  refMsgRow:{display:"flex",gap:"8px",marginBottom:"12px",width:"100%"},
  refMsgAvatar:{width:"34px",height:"34px",borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"1px solid rgba(232,203,157,.55)"},
  refMsgName:{fontSize:"10px",color:"#e7d9ce",marginBottom:"4px",fontWeight:"700"},
  refBubble:{padding:"9px 11px",borderRadius:"13px",fontSize:"12px",lineHeight:1.5,wordBreak:"break-word",boxShadow:"0 3px 10px rgba(0,0,0,.10)"},
  refMyBubble:{background:"linear-gradient(135deg,#fff5de,#f0c985)",color:"#38291f",borderBottomRightRadius:"4px"},
  refOtherBubble:{background:"#f7f2ee",color:"#342a25",borderBottomLeftRadius:"4px"},
  refMsgTime:{fontSize:"8px",color:"#a99c94",whiteSpace:"nowrap"},
  refDelete:{border:0,background:"transparent",color:"#ef6a62",fontSize:"14px",padding:0},
  refNextEvent:{margin:"0 7px 6px",padding:"7px 10px",height:"60px",minHeight:"60px",maxHeight:"60px",border:"1px solid #e6c996",borderRadius:"14px",background:"linear-gradient(135deg,#fffaf0,#f4dfbd)",display:"flex",alignItems:"center",gap:"9px",textAlign:"left",boxShadow:"0 5px 12px rgba(37,23,15,.11)",cursor:"pointer",flex:"0 0 60px",boxSizing:"border-box",overflow:"hidden"},
  refNextGift:{width:"39px",height:"39px",borderRadius:"12px",background:"#fff",display:"grid",placeItems:"center",fontSize:"23px",flexShrink:0},
  refNextCopy:{display:"flex",flexDirection:"column",gap:"2px",minWidth:0,flex:1},
  refNextArrow:{width:"31px",height:"31px",borderRadius:"50%",display:"grid",placeItems:"center",background:"#b67b32",color:"#fff",fontSize:"23px"},
  refComposer:{width:"100%",padding:"7px 9px calc(7px + env(safe-area-inset-bottom, 0px))",height:"calc(62px + env(safe-area-inset-bottom, 0px))",minHeight:"calc(62px + env(safe-area-inset-bottom, 0px))",display:"flex",alignItems:"center",gap:"7px",background:"#f8f2e9",borderTop:"1px solid #eadbc9",flex:"0 0 calc(62px + env(safe-area-inset-bottom, 0px))",position:"relative",zIndex:20,boxSizing:"border-box",overflow:"visible"},
  refPlus:{width:"31px",height:"31px",borderRadius:"50%",display:"grid",placeItems:"center",background:"#fff",border:"1px solid #ded2c4",fontSize:"21px",color:"#8e7d70",cursor:"pointer"},
  refInput:{flex:1,minWidth:0,minHeight:"36px",maxHeight:"76px",resize:"none",border:"1px solid #e2d7ca",borderRadius:"18px",background:"#fff",padding:"8px 13px",outline:"none",fontSize:"16px",lineHeight:"20px",touchAction:"manipulation",WebkitTextSizeAdjust:"100%"},
  refSend:{width:"38px",height:"38px",borderRadius:"50%",border:0,background:"linear-gradient(135deg,#d8a85b,#a86d29)",color:"#fff",fontSize:"17px",cursor:"pointer"},
  refAvatarPicker:{position:"absolute",zIndex:20,top:"64px",left:"12px",right:"12px",padding:"12px",borderRadius:"16px",background:"#fff9ef",boxShadow:"0 18px 45px rgba(45,29,19,.25)",border:"1px solid #e7cfaa"},
  refAvatarPickerTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"},
  refAvatarGrid:{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"6px"},
  refAvatarChoice:{border:0,background:"transparent",padding:0},
  refEventScreen:{flex:1,minHeight:0,overflowY:"auto",padding:"12px",background:"#f7efe5"},
  refHeroEvent:{padding:"16px",borderRadius:"20px",backgroundColor:"#342622",backgroundSize:"cover",backgroundPosition:"center",color:"#fff7ee",boxShadow:"0 12px 26px rgba(66,42,27,.18)",border:"3px solid #fff",overflow:"hidden"},
  refHeroEventTop:{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#e9d7c8"},
  refHeroEventMain:{display:"flex",gap:"13px",alignItems:"center",padding:"15px 0 12px"},
  refHeroTarget:{fontSize:"42px"},
  refHeroDisabled:{padding:"11px",borderRadius:"12px",background:"rgba(255,255,255,.08)",textAlign:"center",fontSize:"11px"},
  refSectionTitle:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 2px 9px"},
  refEventList:{background:"#fffaf4",borderRadius:"17px",overflow:"hidden",border:"1px solid #ead9c6"},
  refEventRow:{display:"grid",gridTemplateColumns:"36px 38px minmax(0,1fr) auto 16px",gap:"8px",alignItems:"center",padding:"11px 9px",borderBottom:"1px solid #eee2d5",background:"#fffaf4"},
  refEventRowActive:{background:"linear-gradient(90deg,#fff8e8,#f8e9cf)",boxShadow:"inset 3px 0 0 #d6a354"},
  refRound:{fontSize:"14px",fontWeight:"900",textAlign:"center"},
  refEventIcon:{fontSize:"23px"},
  refEventInfo:{minWidth:0,display:"flex",flexDirection:"column",gap:"2px"},
  refStatus:{minWidth:"48px",padding:"6px 8px",borderRadius:"999px",fontSize:"9px",fontWeight:"900",whiteSpace:"nowrap",wordBreak:"keep-all",textAlign:"center",lineHeight:1},
  refStatusLive:{background:"#ffe0d7",color:"#d34e3d"},
  refStatusDone:{background:"#eeeae4",color:"#9b9188"},
  refStatusWait:{background:"#f3eee8",color:"#a79b91"},
  refChevron:{fontSize:"19px",color:"#9c8d82"},
  refInlineGame:{marginTop:"8px"},
  refNotice:{margin:"10px 0",padding:"10px",borderRadius:"11px",background:"#fff3db",color:"#76522b",fontSize:"11px"},
  refAiScreen:{flex:1,minHeight:0,overflowY:"auto",padding:"12px",background:"#f7efe5"},
  refAiScreenV2:{padding:"0",background:"#0f1418"},
  refPulse:{padding:"17px",borderRadius:"20px",background:"radial-gradient(circle at 85% 18%,rgba(83,211,194,.18),transparent 28%),linear-gradient(145deg,#1c2b30,#26393d)",color:"#fff",boxShadow:"0 12px 28px rgba(25,43,45,.18)"},
  refPulseHead:{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center"},
  refPulseLabel:{fontSize:"12px",fontWeight:"900",letterSpacing:".4px",marginBottom:"8px"},
  refBot:{width:"72px",height:"72px",borderRadius:"23px",display:"grid",placeItems:"center",fontSize:"48px",background:"radial-gradient(circle,#dffcff,#8ac6c9)",boxShadow:"0 7px 18px rgba(0,0,0,.18)"},
  refLiveDot:{position:"absolute",right:0,top:0,padding:"4px 7px",borderRadius:"999px",background:"#1aa67e",fontSize:"8px",fontWeight:"900"},
  refPulseStats:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"7px",marginTop:"13px"},
  refAiTitle:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 2px 8px"},
  refAssetList:{display:"flex",flexDirection:"column",gap:"8px"},
  refAssetCard:{display:"grid",gridTemplateColumns:"42px minmax(0,1fr) 64px auto",alignItems:"center",gap:"8px",padding:"12px",borderRadius:"15px",background:"#fffaf4",border:"1px solid #ead9c6",boxShadow:"0 5px 14px rgba(72,47,29,.06)"},
  refAssetLogo:{width:"38px",height:"38px",borderRadius:"50%",display:"grid",placeItems:"center",background:"#232a2b",color:"#e6b85f",fontSize:"20px"},
  refAssetName:{display:"flex",flexDirection:"column",gap:"1px"},
  refSpark:{fontSize:"18px",color:"#38a6b2",letterSpacing:"-5px",overflow:"hidden"},
  refAssetGain:{textAlign:"right",display:"flex",flexDirection:"column",gap:"1px"},
  refRecentHead:{display:"flex",justifyContent:"space-between",padding:"15px 2px 8px"},
  refRecentGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"7px",maxHeight:"300px",overflowY:"auto"},
  refRecentItem:{padding:"10px",borderRadius:"12px",background:"#fffaf4",border:"1px solid #ead9c6",display:"flex",flexDirection:"column",gap:"3px",fontSize:"9px"},
  refEducation:{marginTop:"10px",padding:"9px",borderRadius:"10px",background:"#eee5da",color:"#8a796c",fontSize:"9px",textAlign:"center"},
  refAiEmpty:{padding:"28px 14px",textAlign:"center",borderRadius:"15px",background:"#fffaf4",color:"#8f7d70",fontSize:"11px",lineHeight:1.6},
  refPrivateScreen:{flex:"1 1 0",minHeight:0,height:"auto",maxHeight:"100%",display:"flex",flexDirection:"column",background:"#f7efe5",overflow:"hidden",boxSizing:"border-box"},
  refPrivateTop:{padding:"13px",display:"flex",alignItems:"center",gap:"10px",background:"#fffaf4",borderBottom:"1px solid #ead9c6"},
  refPrivateMessages:{flex:"1 1 0",height:0,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",padding:"14px",background:"linear-gradient(180deg,#40332c,#302824)"},
  refSearch:{margin:"0 12px 10px",padding:"11px 13px",borderRadius:"12px",border:"1px solid #dfd0bf",background:"#fff",outline:"none"},
  refConsultList:{margin:"0 12px 12px",borderRadius:"16px",overflow:"hidden",background:"#fffaf4",border:"1px solid #ead9c6"},
  refConsultRow:{width:"100%",display:"grid",gridTemplateColumns:"42px 1fr auto",gap:"10px",alignItems:"center",padding:"11px",border:0,borderBottom:"1px solid #eee2d5",background:"#fffaf4",textAlign:"left",cursor:"pointer"},

  refSupportAvatar:{width:"38px",height:"38px",borderRadius:"50%",objectFit:"cover",border:"2px solid #e1bd82",boxShadow:"0 4px 12px rgba(76,48,29,.10)"},
  refSupportInfo:{display:"flex",flexDirection:"column",gap:"3px",minWidth:0},
  refMoneyBoard:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"7px",margin:"10px 0 14px"},
  refMoneyItem:{minWidth:0,padding:"12px 8px",borderRadius:"14px",background:"linear-gradient(145deg,#fffaf3,#f3e4d1)",border:"1px solid #e5d0b5",boxShadow:"0 5px 14px rgba(76,48,29,.06)",display:"flex",flexDirection:"column",gap:"4px",textAlign:"center"},

  refAiBars:{width:"25px",height:"22px",display:"flex",alignItems:"flex-end",justifyContent:"center",gap:"3px"},
  refProfileButton:{padding:0,border:0,borderRadius:"50%",background:"transparent",cursor:"pointer",display:"grid",placeItems:"center"},
  refProfileOverlay:{position:"fixed",inset:0,zIndex:100,background:"rgba(22,16,13,.62)",display:"flex",alignItems:"center",justifyContent:"center",padding:"18px",backdropFilter:"blur(5px)"},
  refProfileCard:{width:"100%",maxWidth:"360px",position:"relative",padding:"25px 20px 20px",borderRadius:"24px",background:"linear-gradient(160deg,#fffaf1,#f2dfc5)",border:"1px solid #e4c18b",boxShadow:"0 24px 70px rgba(35,22,14,.35)",textAlign:"center",color:"#34251d"},
  refProfileClose:{position:"absolute",right:"12px",top:"10px",width:"32px",height:"32px",padding:0,border:0,borderRadius:"50%",background:"rgba(70,49,34,.08)",fontSize:"22px",lineHeight:"32px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontFamily:"Arial,sans-serif",touchAction:"manipulation"},
  refProfileLarge:{width:"70px",height:"70px",borderRadius:"50%",objectFit:"cover",border:"3px solid #e0b76f",boxShadow:"0 8px 20px rgba(86,54,31,.13)"},
  refProfileVip:{marginTop:"10px",fontSize:"10px",fontWeight:"900",letterSpacing:"1.3px",color:"#a46e2f"},
  refProfileName:{display:"block",fontSize:"21px",marginTop:"4px"},
  refProfileRows:{marginTop:"17px",borderRadius:"15px",overflow:"hidden",border:"1px solid #e5d1b5",background:"rgba(255,255,255,.62)",textAlign:"left"},
  refProfileNote:{margin:"11px 0",fontSize:"9px",color:"#8b796c"},
  refProfileEdit:{width:"100%",padding:"11px",border:0,borderRadius:"12px",background:"linear-gradient(135deg,#c7944e,#9b6529)",color:"#fff",fontWeight:"900",cursor:"pointer"},

  refMemberStripAvatar:{width:"36px",height:"36px",minWidth:"36px",borderRadius:"50%",objectFit:"cover",display:"block",border:"2px solid #e2bd7f",boxShadow:"0 3px 10px rgba(0,0,0,.10)"},
  refConsultAvatar:{width:"36px",height:"36px",minWidth:"36px",borderRadius:"50%",objectFit:"cover",display:"block",border:"1px solid #dfc49b"},
  refPrivateAlert:{position:"fixed",top:"calc(10px + env(safe-area-inset-top, 0px))",left:"50%",transform:"translateX(-50%)",zIndex:9999,width:"calc(100% - 24px)",maxWidth:"496px",minHeight:"58px",padding:"8px 10px",border:"1px solid rgba(222,190,139,.85)",borderRadius:"16px",background:"rgba(255,250,242,.97)",boxShadow:"0 12px 32px rgba(35,22,14,.28)",display:"flex",alignItems:"center",gap:"9px",textAlign:"left",color:"#34251d",cursor:"pointer",boxSizing:"border-box",touchAction:"manipulation"},
  refPrivateAlertAvatar:{width:"40px",height:"40px",borderRadius:"50%",objectFit:"cover",border:"2px solid #d4a552",flexShrink:0},
  refPrivateAlertCopy:{minWidth:0,flex:1,display:"flex",flexDirection:"column",gap:"2px"},
  refPrivateAlertNow:{fontSize:"10px",color:"#9a8778",alignSelf:"flex-start",paddingTop:"3px"},
  refEmojiWrap:{position:"relative",display:"flex",alignItems:"center",flexShrink:0},
  refEmojiButton:{width:"32px",height:"32px",padding:0,borderRadius:"50%",border:"1px solid #ded2c4",background:"#fff",color:"#8a7565",fontSize:"20px",lineHeight:"32px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontFamily:"Arial,sans-serif",touchAction:"manipulation"},
  refEmojiPanel:{position:"fixed",left:"12px",right:"12px",bottom:"calc(68px + env(safe-area-inset-bottom, 0px))",zIndex:200,width:"auto",maxWidth:"496px",margin:"0 auto",padding:"10px",display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",justifyItems:"center",gap:"6px",borderRadius:"16px",background:"#fffaf2",border:"1px solid #dfc59d",boxShadow:"0 15px 38px rgba(49,31,20,.28)",boxSizing:"border-box"},
  refEmojiItem:{width:"34px",height:"34px",padding:0,border:0,borderRadius:"9px",background:"transparent",fontSize:"20px",lineHeight:"34px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",fontFamily:"Arial,sans-serif",touchAction:"manipulation"},

  refRoomIdentity:{display:"flex",flexDirection:"column",gap:"4px",minWidth:0},
  refRoomNameRow:{display:"flex",alignItems:"center",gap:"8px"},
  refVipBadge:{width:"30px",height:"30px",borderRadius:"50%",display:"grid",placeItems:"center",fontStyle:"normal",fontSize:"8px",fontWeight:"900",letterSpacing:".4px",color:"#2b1e16",background:"radial-gradient(circle at 35% 25%,#fff3b5,#d9a34a 48%,#8f5c20 100%)",border:"1px solid #f6d486",boxShadow:"0 3px 10px rgba(217,163,74,.28)"},
  refOnlineText:{display:"flex",alignItems:"center",gap:"5px",fontSize:"9px",fontWeight:"800",color:"#48d18b"},
  refOnlineDot:{width:"6px",height:"6px",borderRadius:"50%",background:"#3bd181",boxShadow:"0 0 8px rgba(59,209,129,.8)"},
  refLogoutButton:{height:"30px",padding:"0 7px",borderRadius:"10px",border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.025)",color:"#bda98c",display:"flex",alignItems:"center",gap:"3px",cursor:"pointer",fontSize:"9px"},
  refEventSuccessToast:{position:"sticky",top:"8px",zIndex:40,margin:"0 8px 10px",padding:"11px 13px",borderRadius:"16px",display:"flex",alignItems:"center",gap:"10px",background:"linear-gradient(145deg,#173a31,#215346)",border:"1px solid rgba(118,231,185,.35)",boxShadow:"0 10px 28px rgba(17,50,42,.24)",color:"#fff"},
  refEventSuccessCheck:{width:"32px",height:"32px",borderRadius:"50%",display:"grid",placeItems:"center",flexShrink:0,background:"linear-gradient(145deg,#7de5b8,#39ad7d)",color:"#123d30",fontSize:"18px",fontWeight:"1000",boxShadow:"0 4px 12px rgba(55,188,132,.25)"},
  refEventSuccessCopy:{minWidth:0,display:"flex",flexDirection:"column",gap:"2px"},
  refEventArtwork:{width:"74px",height:"74px",position:"relative",flexShrink:0,borderRadius:"24px",display:"grid",placeItems:"center",background:"linear-gradient(145deg,rgba(255,255,255,.20),rgba(255,255,255,.04))",border:"1px solid rgba(255,229,181,.35)",boxShadow:"inset 0 0 25px rgba(255,211,128,.12),0 10px 24px rgba(0,0,0,.18)"},
  refEventArtworkHalo:{position:"absolute",inset:"9px",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,212,113,.30),transparent 68%)",filter:"blur(2px)"},
  luxLoginHero:{position:"relative",padding:"20px 12px 16px",margin:"-6px -6px 14px",borderRadius:"25px",overflow:"hidden",textAlign:"center",background:"radial-gradient(circle at 50% 35%,rgba(255,233,185,.96),rgba(255,249,235,.94) 35%,rgba(236,210,171,.78) 100%)",border:"1px solid #e2c18b",boxShadow:"inset 0 1px 0 #fff,0 14px 35px rgba(109,72,34,.13)"},
  luxGlowOne:{position:"absolute",width:"190px",height:"190px",borderRadius:"50%",left:"-80px",top:"-95px",background:"rgba(255,255,255,.72)",filter:"blur(8px)"},
  luxGlowTwo:{position:"absolute",width:"160px",height:"160px",borderRadius:"50%",right:"-70px",bottom:"-85px",background:"rgba(184,119,44,.13)",filter:"blur(10px)"},
  luxCrown:{position:"relative",zIndex:2,fontSize:"30px",color:"#a46a24",textShadow:"0 2px 8px rgba(164,106,36,.22)"},
  luxMascotFrame:{position:"relative",zIndex:2,width:"150px",height:"150px",margin:"13px auto 8px",display:"grid",placeItems:"center",borderRadius:"50%",background:"linear-gradient(145deg,#f6d889,#9f6724)",boxShadow:"0 16px 35px rgba(95,57,21,.23),inset 0 0 0 4px rgba(255,244,210,.9)"},
  luxMascotRing:{position:"absolute",inset:"7px",borderRadius:"50%",border:"1px solid rgba(255,255,255,.78)",boxShadow:"inset 0 0 22px rgba(255,255,255,.35)"},
  luxMascotImage:{width:"130px",height:"130px",borderRadius:"50%",objectFit:"cover",display:"block"},
  luxVipSeal:{position:"absolute",right:"1px",bottom:"13px",width:"42px",height:"42px",borderRadius:"50%",display:"grid",placeItems:"center",fontSize:"10px",fontWeight:"900",letterSpacing:".7px",color:"#fff8df",background:"linear-gradient(145deg,#49301e,#9b682f)",border:"2px solid #efcb7f",boxShadow:"0 5px 14px rgba(55,32,16,.25)"},
  luxHeroCaption:{position:"relative",zIndex:2,fontSize:"8px",fontWeight:"900",letterSpacing:"2.2px",color:"#9d7547"},

  vipReturnPage:{
    minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",
    background:"radial-gradient(circle at 50% 18%,rgba(255,239,201,.95),transparent 31%),radial-gradient(circle at 12% 88%,rgba(157,101,41,.16),transparent 30%),linear-gradient(145deg,#f9f0e3,#e8d4b8 52%,#f8ead7)",
    fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',boxSizing:"border-box"
  },
  vipReturnCard:{
    width:"100%",maxWidth:"390px",position:"relative",overflow:"hidden",padding:"34px 24px 25px",borderRadius:"30px",textAlign:"center",
    background:"linear-gradient(155deg,rgba(255,252,245,.98),rgba(246,231,207,.97))",
    border:"1px solid rgba(185,133,68,.34)",boxShadow:"0 28px 80px rgba(80,48,22,.22),inset 0 1px 0 rgba(255,255,255,.95)",color:"#38271d"
  },
  vipReturnGlowA:{position:"absolute",width:"210px",height:"210px",borderRadius:"50%",left:"-105px",top:"-115px",background:"rgba(255,255,255,.72)",filter:"blur(5px)"},
  vipReturnGlowB:{position:"absolute",width:"190px",height:"190px",borderRadius:"50%",right:"-100px",bottom:"-110px",background:"rgba(171,107,38,.12)",filter:"blur(8px)"},
  vipReturnCrown:{position:"relative",zIndex:2,fontSize:"31px",color:"#a56d29",textShadow:"0 4px 13px rgba(165,109,41,.22)"},
  vipReturnEyebrow:{position:"relative",zIndex:2,marginTop:"5px",fontSize:"8px",fontWeight:"950",letterSpacing:"2.1px",color:"#9e794e"},
  vipReturnAvatarWrap:{position:"relative",zIndex:2,width:"132px",height:"132px",margin:"23px auto 18px",borderRadius:"50%",display:"grid",placeItems:"center",background:"linear-gradient(145deg,#f4d582,#9d6527)",boxShadow:"0 16px 34px rgba(91,55,23,.23),inset 0 0 0 4px #fff1c8"},
  vipReturnAvatarHalo:{position:"absolute",inset:"8px",borderRadius:"50%",border:"1px solid rgba(255,255,255,.82)",boxShadow:"inset 0 0 24px rgba(255,255,255,.4)"},
  vipReturnAvatar:{width:"114px",height:"114px",borderRadius:"50%",objectFit:"cover",display:"block"},
  vipReturnSeal:{position:"absolute",right:"-2px",bottom:"10px",width:"39px",height:"39px",borderRadius:"50%",display:"grid",placeItems:"center",fontSize:"9px",fontWeight:"950",letterSpacing:".5px",color:"#fff6d8",background:"linear-gradient(145deg,#40291b,#95602a)",border:"2px solid #efca77",boxShadow:"0 6px 15px rgba(52,31,15,.24)"},
  vipReturnTitle:{position:"relative",zIndex:2,margin:"0",fontFamily:'Georgia,"Times New Roman",serif',fontSize:"27px",lineHeight:1.28,fontWeight:"700",letterSpacing:"-.7px",color:"#39271d"},
  vipReturnText:{position:"relative",zIndex:2,margin:"12px 0 22px",fontSize:"11px",lineHeight:1.75,color:"#8a7564"},
  vipReturnPrimary:{position:"relative",zIndex:2,width:"100%",height:"52px",border:0,borderRadius:"15px",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",background:"linear-gradient(135deg,#9b6428,#d6a653 52%,#8d5723)",color:"#fffaf0",fontSize:"13px",fontWeight:"950",letterSpacing:".2px",boxShadow:"0 11px 24px rgba(146,91,35,.24),inset 0 1px 0 rgba(255,255,255,.28)",cursor:"pointer"},
  vipReturnSecondary:{position:"relative",zIndex:2,width:"100%",marginTop:"9px",height:"44px",border:"1px solid #dfc8a8",borderRadius:"14px",background:"rgba(255,255,255,.54)",color:"#7b6757",fontSize:"11px",fontWeight:"850",cursor:"pointer"},
  vipReturnFoot:{position:"relative",zIndex:2,marginTop:"19px",display:"flex",justifyContent:"center",alignItems:"center",gap:"9px",fontSize:"7px",fontWeight:"900",letterSpacing:"1.6px",color:"#b09269"},

  refInstallButton:{
    height:"36px",minWidth:"54px",padding:"0 8px",borderRadius:"11px",
    border:"1px solid #d9c19f",background:"linear-gradient(180deg,#fffaf1,#f2e3ce)",
    color:"#6e4a29",display:"flex",alignItems:"center",justifyContent:"center",
    gap:"3px",cursor:"pointer",boxShadow:"0 4px 12px rgba(80,48,22,.08)",position:"relative",zIndex:51,pointerEvents:"auto",touchAction:"manipulation"
  },
  installGuideBackdrop:{
    position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",
    padding:"20px",background:"rgba(37,24,17,.58)",backdropFilter:"blur(8px)"
  },
  installGuideCard:{
    width:"100%",maxWidth:"390px",position:"relative",padding:"28px 22px 22px",borderRadius:"26px",
    background:"linear-gradient(155deg,#fffdf8,#f5e7d3)",border:"1px solid rgba(190,142,79,.42)",
    boxShadow:"0 30px 90px rgba(37,24,17,.35)",textAlign:"center",color:"#3c2a20"
  },
  installGuideClose:{
    position:"absolute",right:"13px",top:"11px",width:"34px",height:"34px",border:0,borderRadius:"50%",
    background:"rgba(74,48,31,.07)",color:"#735b49",fontSize:"22px",cursor:"pointer"
  },
  installGuideIcon:{
    width:"66px",height:"66px",margin:"0 auto 12px",borderRadius:"20px",display:"grid",placeItems:"center",
    fontSize:"31px",background:"linear-gradient(145deg,#3b291f,#8d5c2c)",boxShadow:"0 12px 28px rgba(70,43,24,.22)"
  },
  installGuideEyebrow:{fontSize:"8px",fontWeight:"950",letterSpacing:"2px",color:"#aa7b42"},
  installGuideTitle:{margin:"7px 0 9px",fontFamily:'Georgia,"Times New Roman",serif',fontSize:"23px",color:"#3b281d"},
  installGuideText:{margin:"0 0 17px",fontSize:"11px",lineHeight:1.75,color:"#7b6859"},
  installGuideSteps:{display:"grid",gap:"8px",textAlign:"left"},
  installGuideTip:{marginTop:"14px",padding:"10px",borderRadius:"12px",background:"rgba(158,105,45,.08)",fontSize:"9px",lineHeight:1.55,color:"#8b6a48"},
  installGuideOk:{width:"100%",height:"46px",border:0,borderRadius:"14px",background:"linear-gradient(135deg,#8e5b28,#c8964c)",color:"#fff",fontWeight:"900",cursor:"pointer"},

};