export function aiKrw(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
}

export function aiTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function aiSignedKrw(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : "-"}${aiKrw(Math.abs(n))}`;
}

export function aiSignedPct(value, digits = 3) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function aiFormatMarketPrice(item) {
  const value = Number(item?.price || item?.currentPrice || 0);
  if (!Number.isFinite(value)) return "-";
  if (item?.type === "crypto") {
    if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function aiRemainingText(sim) {
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

export function buildAiChartModel(history, startMoney = 5000000) {
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
