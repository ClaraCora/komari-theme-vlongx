import type { LatestStatus, NodeInfo } from "../lib/api";
import { CURRENCY_SYMBOLS, normalizeCurrency, remainingValue as calculateRemainingValue } from "../lib/finance";
import { daysUntil, fmtBytes, fmtPercent, fmtSpeed, shortOs, trafficUsed } from "../lib/format";
import { fmtCycle, fmtDaysLeft, t } from "../lib/i18n";
import { osIcon } from "../lib/osIcon";
import type { ResolvedLatencySelection } from "../lib/latencySelection";
import type { CardVariant } from "../lib/cardVariant";
import Flag from "./Flag";
import LatencySelectionPanel from "./LatencySelectionPanel";

interface Props {
  node: NodeInfo;
  status?: LatestStatus;
  index: number;
  showLatency: boolean;
  latencySelections: ResolvedLatencySelection[];
  allLatencyTasks: ResolvedLatencySelection[];
  variant: CardVariant;
  onClick: () => void;
}

// subtle 3D tilt, mouse-only
const canTilt =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tiltMove(e: React.MouseEvent<HTMLButtonElement>) {
  if (!canTilt) return;
  const r = e.currentTarget.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.transform = `perspective(900px) rotateX(${(-py * 3.5).toFixed(2)}deg) rotateY(${(px * 4.5).toFixed(2)}deg) translateY(-4px)`;
}

function tiltLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "";
}

const METRIC_COLORS = {
  cpu: "#8b7cf6",
  ram: "#10b981",
  disk: "#f59e0b",
  traffic: "#14b8a6",
  trafficHot: "#f43f5e",
};

function ResourceMetric({
  label,
  pct,
  color,
  detail,
  className = "",
}: {
  label: string;
  pct: number | null;
  color: string;
  detail: string;
  className?: string;
}) {
  const displayPct = pct === null ? "--" : `${pct.toFixed(1)}%`;
  const markerWidth = pct === null || pct <= 0 ? 0 : Math.max(4, Math.min(100, pct));

  return (
    <div className={`resource-metric ${className}`}>
      <div className="resource-metric-heading">
        <span>{label}</span>
        <strong className="num" style={{ color }}>{displayPct}</strong>
      </div>
      <div className="resource-meter-track" aria-hidden="true">
        <span style={{ width: `${markerWidth}%`, background: color }} />
      </div>
      <div className="resource-metric-detail num" title={detail}>{detail}</div>
    </div>
  );
}

function StatPair({
  firstIcon,
  first,
  firstColor,
  firstValueColor,
  secondIcon,
  second,
  secondColor,
  title,
}: {
  firstIcon: string;
  first: string;
  firstColor?: string;
  firstValueColor?: string;
  secondIcon: string;
  second: string;
  secondColor?: string;
  title: string;
}) {
  return (
    <div className="resource-stat-pair num" title={title}>
      <span style={{ color: firstValueColor }}><i style={{ color: firstColor }}>{firstIcon}</i>{first}</span>
      <span><i style={{ color: secondColor }}>{secondIcon}</i>{second}</span>
    </div>
  );
}

function formatCount(value: number | undefined): string {
  return Math.max(0, Number(value) || 0).toLocaleString();
}

function ConnectionsRow({ tcp, udp }: { tcp: number; udp: number }) {
  return (
    <div className="connection-row">
      <span className="text-[12px] text-dim">{t("connections")}</span>
      <div className="connection-values num">
        <span className="connection-item">
          <span className="connection-protocol">{t("tcp")}</span>
          <strong style={{ color: "#8b7cf6" }}>{formatCount(tcp)}</strong>
        </span>
        <span className="connection-divider">·</span>
        <span className="connection-item">
          <span className="connection-protocol">{t("udp")}</span>
          <strong style={{ color: "#14b8c6" }}>{formatCount(udp)}</strong>
        </span>
      </div>
    </div>
  );
}

const BILLING_CURRENCY_SYMBOLS: Record<string, string> = {
  ...CURRENCY_SYMBOLS,
  RMB: "¥",
  "US$": "$",
  CAD: "C$",
  SGD: "S$",
  AUD: "A$",
};

function billingText(node: NodeInfo): string | null {
  const price = Number(node.price);
  if (!Number.isFinite(price) || price === 0) return null;

  const currency = String(node.currency || "$").trim();
  const symbol = BILLING_CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
  const amount = price < 0 ? t("free") : `${symbol}${price}`;
  const cycleDays = Number(node.billing_cycle);
  const cycle = Number.isFinite(cycleDays) && cycleDays > 0 ? fmtCycle(Math.round(cycleDays)) : "";
  return cycle ? `${amount}/${cycle}` : amount;
}

function RingMetric({
  label,
  pct,
  color,
  detail,
}: {
  label: string;
  pct: number | null;
  color: string;
  detail: string;
}) {
  const value = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="variant-c-ring-card">
      <div className="variant-c-ring" style={{ "--ring-pct": value, "--ring-color": color } as React.CSSProperties}>
        <span className="num">{pct === null ? "--" : `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="variant-c-ring-copy">
        <strong>{label}</strong>
        <span className="num" title={detail}>{detail}</span>
      </div>
    </div>
  );
}

function FlowBox({
  direction,
  rate,
  total,
}: {
  direction: "up" | "down";
  rate: string;
  total: string;
}) {
  const upload = direction === "up";
  return (
    <div className={`flow-box flow-box-${direction}`}>
      <div className="flow-box-label">
        <span>{upload ? "↑ 上行速率" : "↓ 下行速率"}</span>
        <span className="flow-box-direction">{upload ? "OUT" : "IN"}</span>
      </div>
      <strong className="flow-box-rate num">{rate}</strong>
      <span className="flow-box-total num">{upload ? "累计已发" : "累计接收"} {total}</span>
    </div>
  );
}

function SlimMetric({
  label,
  pct,
  color,
  detail,
}: {
  label: string;
  pct: number | null;
  color: string;
  detail: string;
}) {
  const width = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="variant-c-slim-metric">
      <div className="variant-c-slim-head">
        <span>{label}</span>
        <span className="num">{detail} {pct === null ? "" : `(${pct.toFixed(1)}%)`}</span>
      </div>
      <div className="variant-c-slim-track"><span style={{ width: `${width}%`, background: color }} /></div>
    </div>
  );
}

function onlineDays(uptime: number | undefined): number {
  const seconds = Number(uptime);
  return Number.isFinite(seconds) ? Math.floor(Math.max(0, seconds) / 86400) : 0;
}

export default function NodeCard({
  node,
  status,
  index,
  showLatency,
  latencySelections,
  allLatencyTasks,
  variant,
  onClick,
}: Props) {
  const online = !!status?.online;
  const billing = billingText(node);
  const cpu = status ? Math.min(100, status.cpu) : 0;
  const ramPct = status ? fmtPercent(status.ram, status.ram_total || node.mem_total) : 0;
  const diskPct = status ? fmtPercent(status.disk, status.disk_total || node.disk_total) : 0;

  const trafficLimit = node.traffic_limit || 0;
  const trafficUse = status ? trafficUsed(status.net_total_up, status.net_total_down, node.traffic_limit_type) : 0;
  const trafficPct = trafficLimit > 0 ? Math.min(100, (trafficUse / trafficLimit) * 100) : 0;
  const trafficColor = trafficPct >= 90 ? METRIC_COLORS.trafficHot : METRIC_COLORS.traffic;

  const expDays = daysUntil(node.expired_at);
  const expSoon = expDays !== null && expDays <= 15;
  const price = Number(node.price);
  const remainingValue =
    expDays !== null && Number.isFinite(price) && price > 0
      ? calculateRemainingValue(node)
      : null;
  const expirationUrgent = expDays !== null && expDays < 8;
  const currencySymbol = CURRENCY_SYMBOLS[normalizeCurrency(node.currency)];
  const remainingValueText =
    price < 0
      ? t("free")
      : remainingValue === null
        ? "--"
        : `${currencySymbol}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(remainingValue)}`;
  const remainingDaysText =
    expDays === null
      ? "--"
      : expDays < 0
        ? t("expired")
        : expDays > 36500
          ? t("longterm")
          : fmtDaysLeft(expDays);

  const tags = (node.tags || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <button
      onClick={onClick}
      onMouseMove={tiltMove}
      onMouseLeave={tiltLeave}
      className={`glass node-card node-card-${variant.toLowerCase()} rounded-[20px] p-4 text-left w-full card-hover rise cursor-pointer ${online ? "" : "offline-card"}`}
      style={{ animationDelay: `${Math.min(index * 55, 600)}ms` }}
    >
      {/* header */}
      <div className="flex items-start gap-2.5 mb-3.5">
        <Flag region={node.region} size={24} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] truncate leading-tight">{node.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-dim truncate mt-0.5">
            <img
              src={osIcon(node.os)}
              alt=""
              width={13}
              height={13}
              loading="lazy"
              className="shrink-0 opacity-90"
            />
            <span className="truncate">
              {shortOs(node.os)} · {node.arch}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1 text-[11px] text-dim num">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${online ? "dot-online" : "dot-offline"}`}
            />
            <span>
              {online && status
                ? `${t("online")} ${onlineDays(status.uptime)}${t("day")}`
                : t("offline")}
            </span>
          </div>
          {billing && variant === "C" && (
            <span className="max-w-[112px] truncate whitespace-nowrap" title={billing}>
              {billing}
            </span>
          )}
        </div>
      </div>

      {variant === "A" && (
        <div className="variant-a-body">
          <div className="resource-grid variant-a-resource-grid">
            <ResourceMetric label={t("cpu")} pct={online ? cpu : 0} color={METRIC_COLORS.cpu}
              detail={online && status ? `${status.load.toFixed(2)}, ${status.load5.toFixed(2)}, ${status.load15.toFixed(2)}` : "--"} />
            <ResourceMetric label={t("ram")} pct={online ? ramPct : 0} color={METRIC_COLORS.ram}
              detail={online && status ? `${fmtBytes(status.ram)} / ${fmtBytes(status.ram_total || node.mem_total)}` : "--"} />
            <ResourceMetric label={t("disk")} pct={online ? diskPct : 0} color={METRIC_COLORS.disk}
              detail={online && status ? `${fmtBytes(status.disk)} / ${fmtBytes(status.disk_total || node.disk_total)}` : "--"} />
            <ResourceMetric label={t("traffic")} pct={trafficLimit > 0 ? (online ? trafficPct : 0) : null} color={trafficColor}
              detail={online && status ? `${fmtBytes(trafficUse)} / ${trafficLimit > 0 ? fmtBytes(trafficLimit) : t("unlimited")}` : "--"} />
          </div>
          <div className="variant-a-flow-grid">
            <FlowBox direction="up" rate={online && status ? fmtSpeed(status.net_out) : "--"} total={online && status ? fmtBytes(status.net_total_up) : "--"} />
            <FlowBox direction="down" rate={online && status ? fmtSpeed(status.net_in) : "--"} total={online && status ? fmtBytes(status.net_total_down) : "--"} />
          </div>
          <div className="variant-a-meta-strip">
            {online && status ? <ConnectionsRow tcp={status.connections} udp={status.connections_udp} /> : <span className="text-dim">{t("offline")}</span>}
            <div className="variant-billing num">
              <span>{billing || t("free")}</span><span className="meta-separator">·</span>
              <span className={expirationUrgent ? "is-urgent" : ""}>{remainingDaysText}</span><span className="meta-separator">·</span>
              <span>{remainingValueText}</span>
            </div>
          </div>
        </div>
      )}

      {variant === "B" && (
        <div className="variant-b-body">
          <div className="variant-b-resource-grid">
            <ResourceMetric label={t("cpu")} pct={online ? cpu : 0} color={METRIC_COLORS.cpu}
              detail={online && status ? `${status.load.toFixed(2)}` : "--"} className="variant-b-metric" />
            <ResourceMetric label={t("ram")} pct={online ? ramPct : 0} color={METRIC_COLORS.ram}
              detail={online && status ? `${fmtBytes(status.ram)}` : "--"} className="variant-b-metric" />
            <ResourceMetric label={t("disk")} pct={online ? diskPct : 0} color={METRIC_COLORS.disk}
              detail={online && status ? `${fmtBytes(status.disk)}` : "--"} className="variant-b-metric" />
            <ResourceMetric label={t("traffic")} pct={trafficLimit > 0 ? (online ? trafficPct : 0) : null} color={trafficColor}
              detail={online && status ? `${fmtBytes(trafficUse)}` : "--"} className="variant-b-metric" />
          </div>
          <div className="variant-b-terminal num">
            <div><span>LOAD:</span> <strong>{online && status ? `${status.load.toFixed(2)} ${status.load5.toFixed(2)} ${status.load15.toFixed(2)}` : "--"}</strong><span className="terminal-conn">CONN: <b>{online && status ? `T:${formatCount(status.connections)}` : "T:--"}</b> <b>{online && status ? `U:${formatCount(status.connections_udp)}` : "U:--"}</b></span></div>
            <div><span>UP:</span> <strong className="terminal-up">{online && status ? fmtSpeed(status.net_out) : "--"}</strong> <small>({online && status ? fmtBytes(status.net_total_up) : "--"})</small><span className="terminal-conn"><span>DOWN:</span> <strong className="terminal-down">{online && status ? fmtSpeed(status.net_in) : "--"}</strong> <small>({online && status ? fmtBytes(status.net_total_down) : "--"})</small></span></div>
          </div>
          <div className="variant-b-footer num"><span>{billing || t("free")}</span><span className={expirationUrgent ? "is-urgent" : ""}>{remainingDaysText}</span><span>{remainingValueText}</span></div>
        </div>
      )}

      {variant === "C" && (
        <div className="variant-c-body">
          <div className="variant-c-ring-grid">
            <RingMetric label={t("cpu")} pct={online ? cpu : 0} color={METRIC_COLORS.cpu} detail={online && status ? `Load ${status.load.toFixed(2)}` : "--"} />
            <RingMetric label={t("ram")} pct={online ? ramPct : 0} color={METRIC_COLORS.ram} detail={online && status ? `${fmtBytes(status.ram)} / ${fmtBytes(status.ram_total || node.mem_total)}` : "--"} />
          </div>
          <div className="variant-c-slim-panel">
            <SlimMetric label={t("disk")} pct={online ? diskPct : 0} color={METRIC_COLORS.disk} detail={online && status ? `${fmtBytes(status.disk)} / ${fmtBytes(status.disk_total || node.disk_total)}` : "--"} />
            <SlimMetric label={t("traffic")} pct={trafficLimit > 0 ? (online ? trafficPct : 0) : null} color={trafficColor} detail={online && status ? `${fmtBytes(trafficUse)} / ${trafficLimit > 0 ? fmtBytes(trafficLimit) : t("unlimited")}` : "--"} />
          </div>
          <div className="variant-c-flow-grid">
            <FlowBox direction="up" rate={online && status ? fmtSpeed(status.net_out) : "--"} total={online && status ? fmtBytes(status.net_total_up) : "--"} />
            <FlowBox direction="down" rate={online && status ? fmtSpeed(status.net_in) : "--"} total={online && status ? fmtBytes(status.net_total_down) : "--"} />
          </div>
          <div className="variant-c-meta-strip">
            <span className="num">{online && status ? `TCP ${formatCount(status.connections)} · UDP ${formatCount(status.connections_udp)}` : t("offline")}</span>
            <span className={`num ${expirationUrgent ? "is-urgent" : ""}`}>{remainingDaysText} · {remainingValueText}</span>
          </div>
        </div>
      )}

      {/* Preferred tasks come first; assigned tasks fill the remaining card slots. */}
      {showLatency && online && (
        <LatencySelectionPanel
          uuid={node.uuid}
          nodeName={node.name}
          cardIndex={index}
          ping={status?.ping}
          selections={latencySelections}
          hoverSelections={allLatencyTasks}
          variant={variant}
        />
      )}

      {(tags.length > 0 || expSoon) && (
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {expSoon && (
            <span
              className="text-[10.5px] px-2 py-0.5 rounded-full font-medium"
              style={{
                color: expDays! <= 3 ? "#fb7185" : "#f59e2b",
                background: "var(--chip)",
                border: `1px solid ${expDays! <= 3 ? "rgba(251,113,133,0.45)" : "rgba(245,158,43,0.45)"}`,
              }}
            >
              {expDays! < 0 ? t("expired") : fmtDaysLeft(expDays!)}
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10.5px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--chip)", border: "1px solid var(--glass-border)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
