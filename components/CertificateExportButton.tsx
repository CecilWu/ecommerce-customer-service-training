"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export function CertificateExportButton({ certificateNo }: { certificateNo: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  async function exportCertificate() {
    const certificate = document.getElementById("apprentice-certificate");
    if (!certificate || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl("");
    }
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(certificate, {
        backgroundColor: "#ffffff",
        scale: Math.min(2.2, window.devicePixelRatio * 1.5),
        useCORS: true,
        logging: false
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
      const blob = pdf.output("blob");
      const nextDownloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = nextDownloadUrl;
      downloadLink.download = `${certificateNo || "电商客服出师证书"}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setDownloadUrl(nextDownloadUrl);
      setSuccess("PDF已生成");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PDF生成失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
      <button className="button secondary" type="button" onClick={exportCertificate} disabled={busy}>
        <Download size={17} />
        {busy ? "正在生成PDF..." : "导出证书"}
      </button>
      {error ? <small className="danger-text">{error}</small> : null}
      {success ? <small className="success-text">{success}</small> : null}
      {downloadUrl ? (
        <a className="button secondary compact-button" href={downloadUrl} download={`${certificateNo || "电商客服出师证书"}.pdf`}>
          <Download size={15} />
          下载PDF
        </a>
      ) : null}
    </div>
  );
}
