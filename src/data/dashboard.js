export const clusters = [
  {
    id: "prod-eventmesh-east",
    name: "prod-eventmesh-east",
    status: "Healthy",
    score: 98,
    version: "1.11.0",
    clusterId: "em-5f8a9c2d",
    uptime: "18d 6h",
    created: "2026-07-21 09:14",
    region: "us-east-1",
    runtimes: 6,
    topics: 1248,
    groups: 632,
    inbound: "92.3K",
    outbound: "74.6K",
  },
  {
    id: "prod-eventmesh-west",
    name: "prod-eventmesh-west",
    status: "Healthy",
    score: 96,
    version: "1.11.0",
    clusterId: "em-7bd9d142",
    uptime: "31d 2h",
    created: "2026-06-28 16:32",
    region: "us-west-2",
    runtimes: 8,
    topics: 982,
    groups: 418,
    inbound: "68.1K",
    outbound: "52.7K",
  },
  {
    id: "staging-eventmesh",
    name: "staging-eventmesh",
    status: "Warning",
    score: 82,
    version: "1.10.2",
    clusterId: "em-a3108ef4",
    uptime: "9d 11h",
    created: "2026-08-01 11:08",
    region: "ap-southeast-1",
    runtimes: 4,
    topics: 336,
    groups: 125,
    inbound: "18.4K",
    outbound: "14.2K",
  },
];

export const runtimes = [
  ["em-runtime-1", "28%", "41%", "12.4K"],
  ["em-runtime-2", "31%", "45%", "11.8K"],
  ["em-runtime-3", "26%", "38%", "9.7K"],
  ["em-runtime-4", "33%", "46%", "10.9K"],
  ["em-runtime-5", "24%", "36%", "8.6K"],
  ["em-runtime-6", "29%", "42%", "11.2K"],
].map(([id, cpu, memory, connections]) => ({ id, cpu, memory, connections }));

export const recentChanges = [
  { type: "success", title: "Runtime em-runtime-6 started", detail: "Started successfully", time: "2026-08-11 11:28:34" },
  { type: "info", title: "Configuration updated", detail: "num.network.threads increased to 8", time: "2026-08-11 10:42:18" },
  { type: "success", title: "Topic orders-events created", detail: "Partitions: 12, Replication: 3", time: "2026-08-11 09:17:52" },
  { type: "warning", title: "High memory usage on em-runtime-2", detail: "Memory usage at 85%", time: "2026-08-11 08:55:11" },
  { type: "success", title: "Consumer group billing-service deployed", detail: "Generation 15", time: "2026-08-11 08:12:07" },
];

const baseInbound = [72, 79, 79, 79, 75, 82, 88, 82, 87, 80, 75, 77, 77, 80, 89, 93, 84, 89, 84, 91, 101, 101, 103, 96, 91, 94, 91, 99, 88, 81, 84, 81, 86, 93, 87, 92, 87, 91, 93, 96, 89, 92, 86, 91, 87];
const baseOutbound = [48, 55, 55, 56, 51, 59, 64, 59, 63, 56, 51, 54, 53, 55, 63, 68, 63, 66, 61, 68, 76, 77, 74, 69, 63, 65, 66, 74, 63, 56, 59, 58, 62, 68, 62, 66, 61, 65, 67, 72, 64, 67, 63, 68, 65];

export function throughputFor(range) {
  const multiplier = { "1H": 1, "6H": 0.94, "24H": 0.83, "7D": 0.72, "30D": 0.62 }[range] ?? 1;
  const labels = baseInbound.map((_, index) => {
    const minutes = 30 + index * 7;
    const hour = 6 + Math.floor(minutes / 60);
    return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
  return {
    labels,
    inbound: baseInbound.map((value) => Math.round(value * multiplier)),
    outbound: baseOutbound.map((value) => Math.round(value * multiplier)),
  };
}
