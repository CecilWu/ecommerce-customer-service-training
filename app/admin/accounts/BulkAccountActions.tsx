"use client";

import { useRef, useState } from "react";
import { KeyRound, ShieldAlert, Trash2, X } from "lucide-react";

const DELETE_CONFIRMATION = "吴晓波";

export function BulkAccountActions() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");

  function closeDialog() {
    dialogRef.current?.close();
    setConfirmation("");
  }

  return (
    <form id="bulk-actions-form" className="bulk-actions-form" action="/api/admin/users" method="post">
      <button className="button warning nowrap-button" name="action" value="bulk-reset" type="submit">
        <KeyRound size={17} />
        批量重置密码
      </button>
      <button className="button danger nowrap-button" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Trash2 size={17} />
        批量删除
      </button>

      <dialog
        className="confirmation-dialog"
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
      >
        <div className="confirmation-dialog-head">
          <span className="confirmation-dialog-icon"><ShieldAlert size={22} /></span>
          <div>
            <h2>确认批量删除账号</h2>
            <p>删除后账号将被停用。超级管理员 admin 和当前登录账号不会被删除。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭确认框" title="关闭" onClick={closeDialog}>
            <X size={20} />
          </button>
        </div>

        <label className="field confirmation-dialog-field">
          <span>请输入“{DELETE_CONFIRMATION}”确认操作</span>
          <input
            autoComplete="off"
            autoFocus
            className="input"
            name="deleteConfirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={DELETE_CONFIRMATION}
          />
        </label>

        <div className="confirmation-dialog-actions">
          <button className="button secondary" type="button" onClick={closeDialog}>取消</button>
          <button
            className="button danger"
            name="action"
            value="bulk-delete"
            type="submit"
            disabled={confirmation.trim() !== DELETE_CONFIRMATION}
          >
            <Trash2 size={17} />
            确认删除所选账号
          </button>
        </div>
      </dialog>
    </form>
  );
}
