"use client";

import { useState } from "react";
import { BrainCircuit } from "lucide-react";

const providerPresets = {
  deepseek: {
    name: "DeepSeek 客服训练模型",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  },
  openai: {
    name: "OpenAI 客服训练模型",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  qwen: {
    name: "通义千问 客服训练模型",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus"
  },
  doubao: {
    name: "豆包 客服训练模型",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615"
  },
  custom: {
    name: "自定义 OpenAI兼容模型",
    baseUrl: "",
    model: ""
  }
};

type ProviderKey = keyof typeof providerPresets;

export function AiProviderForm() {
  const [provider, setProvider] = useState<ProviderKey>("deepseek");
  const [name, setName] = useState(providerPresets.deepseek.name);
  const [baseUrl, setBaseUrl] = useState(providerPresets.deepseek.baseUrl);
  const [model, setModel] = useState(providerPresets.deepseek.model);

  function updateProvider(value: ProviderKey) {
    const preset = providerPresets[value];
    setProvider(value);
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  }

  return (
    <form className="stack" action="/api/admin/ai-providers" method="post">
      <input type="hidden" name="action" value="save" />
      <div className="form-grid">
        <label className="field">
          <span>配置名称</span>
          <input className="input" name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>供应商</span>
          <select className="select" name="provider" value={provider} onChange={(event) => updateProvider(event.target.value as ProviderKey)}>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI兼容</option>
            <option value="qwen">通义千问兼容</option>
            <option value="doubao">豆包兼容</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <label className="field">
          <span>API接口地址</span>
          <input className="input" name="baseUrl" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://..." required />
        </label>
        <label className="field">
          <span>模型名称</span>
          <input className="input" name="model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 deepseek-chat" required />
        </label>
      </div>
      <label className="field">
        <span>API Key</span>
        <input className="input" name="apiKey" type="password" placeholder="保存后将加密存储，不会明文展示" />
      </label>
      <label className="check-item" style={{ width: "fit-content" }}>
        <input type="checkbox" name="isActive" defaultChecked />
        <span>
          <strong>保存后立即启用</strong>
          <small>启用后训练和评分会优先调用该模型</small>
        </span>
      </label>
      <button className="button primary" type="submit">
        <BrainCircuit size={17} />
        保存AI模型配置
      </button>
    </form>
  );
}
