import axios from "axios";
import { apiConfig } from "./config.js";

export const apiClient = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeoutMs,
  headers: {
    "Content-Type": "application/json",
    queryClause: JSON.stringify({ limitPageNum: 1, limitSize: 200 }),
  },
});
