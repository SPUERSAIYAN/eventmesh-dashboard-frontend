import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import { useState, type ReactNode } from "react";

export type ResourceTableRow = {
  key: string | number;
  search?: string;
  cells: ReactNode[];
  onClick?: () => void;
  className?: string;
};

type ResourceTableProps = {
  title: string;
  description: string;
  columns: string[];
  rows: ResourceTableRow[];
  action?: ReactNode;
  searchable?: boolean;
  showRefresh?: boolean;
  searchPlaceholder?: string;
  sectionClassName?: string;
  tableClassName?: string;
};

export function ResourceTable({
  title,
  description,
  columns,
  rows,
  action = null,
  searchable = true,
  showRefresh = true,
  searchPlaceholder = "搜索资源",
  sectionClassName = "panel storage-resource-panel",
  tableClassName = "resource-table storage-resource-table",
}: ResourceTableProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery ? rows.filter((row) => (row.search ?? row.cells.join(" ")).toLowerCase().includes(normalizedQuery)) : rows;
  const moduleVariant = sectionClassName.includes("mock-module-panel");

  return <section className={sectionClassName}>
    <div className={moduleVariant ? "mock-section-title" : "storage-resource-toolbar"}>
      <div><h2>{title}</h2><p>{description}</p></div>
      {moduleVariant ? action : <div>
          {searchable && <Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} />}
          {showRefresh && <Button icon={<ReloadOutlined />}>刷新</Button>}
          {action}
        </div>}
    </div>
    <div className="resource-table-wrap">
      <table className={tableClassName}><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.key} className={row.className} onClick={row.onClick}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table>
      {!filtered.length && <div className="storage-console-empty"><SearchOutlined /><strong>未找到匹配资源</strong><span>请调整搜索条件。</span></div>}
    </div>
  </section>;
}
