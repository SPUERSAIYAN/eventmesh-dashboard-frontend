import { useEffect, useState } from "react";
import { App as AntApp, Input, InputNumber, Modal, Select } from "antd";
import { AppstoreAddOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { ensureSimName } from "./mockWritableResources";

export function CreateNodeModal({ open, onClose, kind, cluster, existingNames, onCreate }) {
  const { message } = AntApp.useApp();
  const kindCopy = kind === "runtime" ? "Runtime 实例" : kind === "meta" ? "Meta 节点" : "Broker";
  const fallback = kind === "runtime" ? "codex-sim-runtime-new-01" : kind === "meta" ? "codex-sim-meta-new-01" : `codex-sim-${cluster?.type ?? "broker"}-broker-new-01`;
  const [name, setName] = useState(fallback);
  const [address, setAddress] = useState("待分配");
  const [role, setRole] = useState(kind === "runtime" ? "Runtime" : kind === "meta" ? "Follower" : "Broker");
  useEffect(() => { if (open) { setName(fallback); setAddress("待分配"); setRole(kind === "runtime" ? "Runtime" : kind === "meta" ? "Follower" : "Broker"); } }, [fallback, kind, open]);
  const submit = () => {
    const safeName = ensureSimName(name, fallback);
    if (existingNames.includes(safeName)) { message.error(`${kindCopy}名称已存在`); return; }
    onCreate({ id: safeName, clusterId: cluster.id, name: safeName, role, address, status: "healthy", cpu: kind === "runtime" ? 0 : undefined, memory: kind === "runtime" ? 0 : undefined, rate: kind === "runtime" ? "0/s" : undefined, latency: kind === "meta" ? "0 ms" : undefined, createdAt: new Date().toISOString() });
    message.success(`已添加 ${kindCopy}：${safeName}`); onClose();
  };
  return <Modal title={`添加${kindCopy}`} open={open} onCancel={onClose} onOk={submit} okText="确认添加" cancelText="取消"><div className="mock-flow-note"><PlusOutlined/><div><strong>扩容当前集群</strong><span>这是前端模拟操作，新增资源会保存在本地并同步更新集群数量。</span></div></div><div className="mock-write-form"><label>名称<Input value={name} onChange={(event)=>setName(event.target.value)} /></label><label>角色<Select value={role} onChange={setRole} options={(kind === "runtime" ? ["Runtime"] : kind === "meta" ? ["Follower","Observer"] : cluster?.type === "rocketmq" ? ["Master","Slave"] : ["Kafka Broker"]).map((value)=>({value,label:value}))}/></label><label>地址<Input value={address} onChange={(event)=>setAddress(event.target.value)} placeholder="例如 10.18.1.20:10000" /></label></div></Modal>;
}

export function CreateTopicModal({ open, onClose, eventMeshClusterId, storageClusters, fixedStorage=null, existingNames, onCreate }) {
  const { message } = AntApp.useApp();
  const initialStorage = fixedStorage ?? storageClusters[0] ?? null;
  const [name, setName] = useState("codex-sim-new-topic");
  const [storageId, setStorageId] = useState(initialStorage?.id);
  const [partitions, setPartitions] = useState(initialStorage?.type === "rocketmq" ? 8 : 12);
  const [replicas, setReplicas] = useState(initialStorage?.type === "rocketmq" ? 2 : 3);
  useEffect(() => { if (open) { setName("codex-sim-new-topic"); setStorageId(initialStorage?.id); setPartitions(initialStorage?.type === "rocketmq" ? 8 : 12); setReplicas(initialStorage?.type === "rocketmq" ? 2 : 3); } }, [initialStorage, open]);
  const selected = fixedStorage ?? storageClusters.find((item)=>item.id===storageId);
  const submit = () => {
    const safeName = ensureSimName(name, "codex-sim-new-topic");
    if (!selected) { message.error("请先关联 Kafka 或 RocketMQ 存储集群"); return; }
    if (existingNames.includes(safeName)) { message.error("Topic 名称已存在"); return; }
    onCreate({ id:`topic-${Date.now()}`, eventMeshClusterId, storageClusterId:selected.id, engine:selected.type, name:safeName, partitions:Number(partitions), replicas:Number(replicas), status:"healthy", createdAt:new Date().toISOString() });
    message.success(`已创建 Topic：${safeName}`); onClose();
  };
  return <Modal title={fixedStorage?`创建 ${fixedStorage.type === "kafka" ? "Kafka" : "RocketMQ"} 物理 Topic`:"添加业务 Topic"} open={open} onCancel={onClose} onOk={submit} okText="创建 Topic" cancelText="取消" okButtonProps={{disabled:!selected}}><div className="mock-flow-note"><AppstoreAddOutlined/><div><strong>{fixedStorage?"写入当前存储集群":"统一创建业务 Topic"}</strong><span>{fixedStorage?"该 Topic 只创建在当前 Kafka/RocketMQ 集群中。":"创建后会同步写入 EventMesh Topic 列表和所选存储集群的物理 Topic 列表。"}</span></div></div><div className="mock-write-form"><label>Topic 名称<Input value={name} onChange={(event)=>setName(event.target.value)} /></label><label>存储集群<Select disabled={Boolean(fixedStorage)} value={selected?.id} onChange={(value)=>{setStorageId(value);const item=storageClusters.find((candidate)=>candidate.id===value);setPartitions(item?.type==="rocketmq"?8:12);setReplicas(item?.type==="rocketmq"?2:3);}} options={storageClusters.map((item)=>({value:item.id,label:`${item.type === "kafka" ? "Kafka" : "RocketMQ"} · ${item.name}`}))}/></label><div className="mock-write-form-columns"><label>{selected?.type === "rocketmq" ? "队列数量" : "分区数量"}<InputNumber min={1} max={128} value={partitions} onChange={(value)=>setPartitions(value??1)} /></label><label>副本数量<InputNumber min={1} max={5} value={replicas} onChange={(value)=>setReplicas(value??1)} /></label></div></div></Modal>;
}

export function CreateConsumerModal({ open, onClose, eventMeshClusterId, topics, existingNames, onCreate }) {
  const { message } = AntApp.useApp();
  const [name, setName] = useState("codex-sim-new-consumer-group");
  const [topic, setTopic] = useState(topics[0]);
  const [members, setMembers] = useState(3);
  useEffect(() => { if(open){ setName("codex-sim-new-consumer-group"); setTopic(topics[0]); setMembers(3); } }, [open, topics]);
  const submit=()=>{ const safeName=ensureSimName(name,"codex-sim-new-consumer-group"); if(existingNames.includes(safeName)){message.error("Consumer Group 名称已存在");return;} if(!topic){message.error("请先创建 Topic");return;} onCreate({id:`consumer-${Date.now()}`,eventMeshClusterId,name:safeName,topic,members:Number(members),rate:"0/s",lag:"0",status:"healthy",createdAt:new Date().toISOString()});message.success(`已创建 Consumer Group：${safeName}`);onClose(); };
  return <Modal title="添加 Consumer Group" open={open} onCancel={onClose} onOk={submit} okText="确认创建" cancelText="取消" okButtonProps={{disabled:!topic}}><div className="mock-flow-note"><TeamOutlined/><div><strong>创建消费者组</strong><span>选择要订阅的 EventMesh Topic，创建后会出现在当前集群的消费者列表中。</span></div></div><div className="mock-write-form"><label>Consumer Group 名称<Input value={name} onChange={(event)=>setName(event.target.value)} /></label><label>订阅 Topic<Select value={topic} onChange={setTopic} options={topics.map((value)=>({value,label:value}))}/></label><label>初始实例数<InputNumber min={1} max={64} value={members} onChange={(value)=>setMembers(value??1)} /></label></div></Modal>;
}
