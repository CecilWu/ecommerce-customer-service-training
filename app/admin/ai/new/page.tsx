import { BrainCircuit } from "lucide-react";
import { AiProviderForm } from "./AiProviderForm";

export default function AdminAiCreatePage() {
  return (
    <>
      <div className="admin-page-title">
        <div>
          <span className="eyebrow">AI模型</span>
          <h1>新增AI模型</h1>
          <p>配置DeepSeek或其他OpenAI兼容模型。API Key保存后不会在页面明文显示。</p>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <BrainCircuit size={22} />
            <div>
              <h2>模型调用配置</h2>
              <p>保存后可立即启用，训练和评分会优先调用启用模型。</p>
            </div>
          </div>
        </div>
        <AiProviderForm />
      </section>
    </>
  );
}
