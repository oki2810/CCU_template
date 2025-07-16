// loglist.js

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("log-list");
  const confirmBtn = document.getElementById("confirm-btn");
  const { owner, repo, apiBase } = window.CCU_CONFIG;
  console.log("CCU_CONFIG:", window.CCU_CONFIG);
  if (!list || !confirmBtn) return;

  // クライアント側での仮データ保持
  // 初期表示時に現在の並び順を pendingOrder にセット
  let pendingOrder = Array.from(list.children).map(li => li.dataset.path);
  const pendingDeletes = new Set();

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
      li.classList.remove("list-group-item-danger");
    } else {
      pendingDeletes.add(path);
      li.classList.add("list-group-item-danger");
    }
    confirmBtn.disabled = false;
  });

  // 「確定」ボタン：一括反映用 API を呼び出し
  confirmBtn.addEventListener("click", async () => {
    // 確定前に最新の順序を取得
    pendingOrder = Array.from(list.children).map(li => li.dataset.path);

    confirmBtn.disabled = true;
    confirmBtn.textContent = "反映中…";

    try {
      const resp = await fetch(
        `https://ccfolialoguploader.com/api/apply-changes`,
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

      // ビルド完了を待つポーリング関数
      async function waitForBuildCompletion(owner, repo) {
        const POLL_INTERVAL = 5_000;
        while (true) {
          const res = await fetch('https://ccfolialoguploader.com/api/pages-status', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, repo })
          });
          const data = await res.json();
          if (data.ok && data.status === 'built') {
            // ビルド完了
            return;
          }
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
      }
      
      // apply-changes 成功後に呼び出し
      confirmBtn.textContent = 'デプロイ待ち…';
      await waitForBuildCompletion(owner, repo);

      // ビルド完了したら画面をリロード
      location.reload();
    } catch (err) {
      console.error("Apply changes failed:", err);
      alert("反映に失敗しました: " + err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "確定";
    }
  });
});
