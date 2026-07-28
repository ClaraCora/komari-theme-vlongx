import type { LatestStatus, NodeInfo } from "../lib/api";
import { CURRENCY_SYMBOLS, normalizeCurrency, remainingValue as calculateRemainingValue } from "../lib/finance";
import { daysUntil, fmtBytes, fmtPercent, fmtSpeed, shortOs, trafficUsed } from "../lib/format";
import { fmtDaysLeft, t } from "../lib/i18n";
import { osIcon } from "../lib/osIcon";
import type { ResolvedLatencySelection } from "../lib/latencySelection";
import Flag from "./Flag";
import LatencySelectionPanel from "./LatencySelectionPanel";

interface Props {
  node: NodeInfo;
  status?: LatestStatus;
  index: number;
  showLatency: boolean;
  latencySelections: ResolvedLatencySelection[];
  allLatencyTasks: ResolvedLatencySelection[];
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
}: {
  label: string;
  pct: number | null;
  color: string;
  detail: string;
}) {
  const displayPct = pct === null ? "--" : `${pct.toFixed(1)}%`;
  const markerWidth = pct === null || pct <= 0 ? 0 : Math.max(4, Math.min(100, pct));

  return (
    <div className="resource-metric">
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

export default function NodeCard({
  node,
  status,
  index,
  showLatency,
  latencySelections,
  allLatencyTasks,
  onClick,
}: Props) {
  const online = !!status?.online;
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
      className={`glass rounded-[20px] p-4 text-left w-full card-hover rise cursor-pointer ${online ? "" : "offline-card"}`}
      style={{ animationDelay: `${Math.min(index * 55, 600)}ms` }}
    >
      {/* header */}
      <div className="flex items-center gap-2.5 mb-3.5">
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
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${online ? "dot-online" : "dot-offline"}`}
        />
        <span className="text-[11px] text-dim">{online ? t("online") : t("offline")}</span>
      </div>

      {/* compact two-column resource metrics */}
      <div className="resource-grid">
        <ResourceMetric
          label={t("cpu")}
          pct={online ? cpu : 0}
          color={METRIC_COLORS.cpu}
          detail={online && status ? `${status.load.toFixed(2)}, ${status.load5.toFixed(2)}, ${status.load15.toFixed(2)}` : "--"}
        />
        <ResourceMetric
          label={t("ram")}
          pct={online ? ramPct : 0}
          color={METRIC_COLORS.ram}
          detail={online && status ? `${fmtBytes(status.ram)} / ${fmtBytes(status.ram_total || node.mem_total)}` : "--"}
        />
        <ResourceMetric
          label={t("disk")}
          pct={online ? diskPct : 0}
          color={METRIC_COLORS.disk}
          detail={online && status ? `${fmtBytes(status.disk)} / ${fmtBytes(status.disk_total || node.disk_total)}` : "--"}
        />
        <ResourceMetric
          label={t("traffic")}
          pct={trafficLimit > 0 ? (online ? trafficPct : 0) : null}
          color={trafficColor}
          detail={
            online && status
              ? `${fmtBytes(trafficUse)} / ${trafficLimit > 0 ? fmtBytes(trafficLimit) : t("unlimited")}`
              : "--"
          }
        />
      </div>

      {/* realtime speed, accumulated traffic, and remaining term/value */}
      <div className="resource-secondary-grid">
        <StatPair
          title={t("netSpeed")}
          firstIcon="↑"
          first={online && status ? fmtSpeed(status.net_out) : "--"}
          firstColor="#10b981"
          secondIcon="↓"
          second={online && status ? fmtSpeed(status.net_in) : "--"}
          secondColor="#3b82f6"
        />
        <StatPair
          title={t("totalTraffic")}
          firstIcon="↥"
          first={online && status ? fmtBytes(status.net_total_up) : "--"}
          secondIcon="↧"
          second={online && status ? fmtBytes(status.net_total_down) : "--"}
        />
        <StatPair
          title={`${t("remainingDays")} / ${t("remainingValue")}`}
          firstIcon="◷"
          first={remainingDaysText}
          firstColor={expirationUrgent ? "#f43f5e" : undefined}
          firstValueColor={expirationUrgent ? "#f43f5e" : undefined}
          secondIcon="¤"
          second={remainingValueText}
        />
      </div>

      {/* TCP / UDP connection counts sit directly below traffic */}
      {online && status && (
        <ConnectionsRow tcp={status.connections} udp={status.connections_udp} />
      )}

      {/* User-selected exact latency tasks follow the resource metrics. */}
      {showLatency && online && (
        <LatencySelectionPanel
          uuid={node.uuid}
          nodeName={node.name}
          cardIndex={index}
          ping={status?.ping}
          selections={latencySelections}
          hoverSelections={allLatencyTasks}
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
