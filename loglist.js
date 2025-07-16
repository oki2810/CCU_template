// loglist.js
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("log-list");
  const confirmBtn = document.getElementById("confirm-btn");
  const { owner, repo, apiBase } = window.CCU_CONFIG;
  if (!list || !confirmBtn) return;

  // クライアント側での仮データ保持
  let pendingOrder = [];
  const pendingDeletes = new Set();

  // 初期表示：既存の <li> はサーバー側で index.html に埋め込み済み（または別途取得）
  // → 必要ならここで fetch して描画するコードを追加

  // Sortable の設定（UI 上で並べ替え）
  new Sortable(list, {
    animation: 150,
    onEnd: () => {
      // 並び替え結果を仮保存
      pendingOrder = Array.from(list.children).map(li => li.dataset.path);
      confirmBtn.disabled = false;
    }
  });

  // 削除トグル：ボタンクリックで赤背景トグル＆仮保存
  list.addEventListener("click", e => {
    const btn = e.target.closest(".btn-delete");
    if (!btn) return;
    const li = btn.closest("li");
    const path = li.dataset.path;
    if (pendingDeletes.has(path)) {
      pendingDeletes.delete(path);
      li.classList.remove("table-danger");
    } else {
      pendingDeletes.add(path);
      li.classList.add("table-danger");
    }
    confirmBtn.disabled = false;
  });

  // 「確定」ボタン：一括反映用 API を呼び出し
  confirmBtn.addEventListener("click", async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "反映中…";

    try {
      const resp = await fetch(
        `https://ccfolia-log-uploader-theta.vercel.app/api/apply-changes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            owner,
            repo,
            order: pendingOrder,
            deletes: Array.from(pendingDeletes)
          })
        }
      );
      const result = await resp.json();
      if (!resp.ok || !result.ok) {
        throw new Error(result.error || "Unknown error");
      }
      // 成功したらリロードして最新状態を取得
      location.reload();
    } catch (err) {
      console.error("Apply changes failed:", err);
      alert("反映に失敗しました: " + err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "確定";
    }
  });
});
