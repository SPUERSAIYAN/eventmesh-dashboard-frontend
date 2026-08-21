export const mockClusters = [
  { id:"prod-eventmesh-east", name:"prod-eventmesh-east", description:"订单与交易消息主集群", status:"healthy", region:"华东 1（杭州）", version:"1.11.0", hosting:"Alibaba Cloud ACK", hostingType:"Kubernetes", kubernetes:"ack-prod-east-01", uptime:"20 天 22 小时", cpu:46, memory:62, storage:38, runtimes:6, metaNodes:3, topics:["order-created","payment-status","inventory-sync","shipment-events","refund-events"], consumers:["order-service","payment-worker","inventory-center","logistics-sync"], inRate:92340, outRate:74620 },
  { id:"prod-eventmesh-south", name:"prod-eventmesh-south", description:"会员与营销业务集群", status:"healthy", region:"华南 1（深圳）", version:"1.11.0", hosting:"Alibaba Cloud ACK", hostingType:"Kubernetes", kubernetes:"ack-prod-south-02", uptime:"31 天 8 小时", cpu:58, memory:71, storage:54, runtimes:8, metaNodes:3, topics:["member-profile","campaign-trigger","coupon-issued","points-change"], consumers:["crm-service","campaign-engine","points-worker"], inRate:68120, outRate:52740 },
  { id:"staging-eventmesh", name:"staging-eventmesh", description:"集成测试与压测环境", status:"warning", region:"华东 2（上海）", version:"1.10.2", hosting:"自建 Kubernetes", hostingType:"Kubernetes", kubernetes:"staging-k8s-01", uptime:"9 天 11 小时", cpu:76, memory:84, storage:67, runtimes:4, metaNodes:3, topics:["load-test","integration-events","qa-callback"], consumers:["test-runner","qa-recorder"], inRate:18420, outRate:14210 },
  { id:"edge-eventmesh-north", name:"edge-eventmesh-north", description:"北方边缘接入集群", status:"unknown", region:"华北 2（北京）", version:"1.10.2", hosting:"物理机托管", hostingType:"主机集群", kubernetes:"—", uptime:"6 天 3 小时", cpu:33, memory:45, storage:29, runtimes:3, metaNodes:3, topics:["edge-device-event","device-heartbeat"], consumers:["iot-gateway","device-observer"], inRate:9620, outRate:8310 },
];

export const mockRuntimeNodes = [
  ["runtime-east-01","10.18.1.11:10000",42,58,"16.8K/s"], ["runtime-east-02","10.18.1.12:10000",47,63,"15.9K/s"],
  ["runtime-east-03","10.18.1.13:10000",51,66,"15.2K/s"], ["runtime-east-04","10.18.1.14:10000",38,54,"14.8K/s"],
  ["runtime-east-05","10.18.1.15:10000",44,61,"15.1K/s"], ["runtime-east-06","10.18.1.16:10000",49,67,"14.5K/s"],
].map(([name,address,cpu,memory,rate]) => ({ name,address,cpu,memory,rate,status:"正常",role:"Runtime" }));

export const mockMetaNodes = [
  { name:"meta-east-01", role:"Leader", address:"10.18.0.11:2379", latency:"7 ms", status:"正常" },
  { name:"meta-east-02", role:"Follower", address:"10.18.0.12:2379", latency:"9 ms", status:"正常" },
  { name:"meta-east-03", role:"Follower", address:"10.18.0.13:2379", latency:"8 ms", status:"正常" },
];

export const mockMessageSeries = {
  labels:["09:00","09:10","09:20","09:30","09:40","09:50","10:00","10:10","10:20","10:30","10:40","10:50"],
  inbound:[68,72,70,79,82,78,84,88,85,91,89,92], outbound:[51,54,57,59,62,60,66,64,69,71,70,75],
};
