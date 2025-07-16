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
    // 最新の順序を取得
    pendingOrder = Array.from(list.children).map(li => li.dataset.path);

    confirmBtn.disabled = true;
    confirmBtn.textContent = "反映中…";

    try {
      // ① apply-changes を叩く
      const resp = await fetch(
        `${apiBase}/api/apply-changes`,
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

      // ② コミット SHA を取り出す
      const commitSha = result.commit;
      if (!commitSha) {
        throw new Error("コミット SHA が返ってきませんでした");
      }

      // ③ ビルド完了を待つポーリング関数を呼び出し（commit を渡す）
      confirmBtn.textContent = "デプロイ待ち…";
      await waitForBuildCompletion(owner, repo, commitSha);

      // ④ ビルド完了したらリロード
      location.reload();

    } catch (err) {
      console.error("Apply changes failed:", err);
      alert("反映に失敗しました: " + err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "確定";
    }
  });

  // ポーリング関数も commit を受け取るように変更
  async function waitForBuildCompletion(owner, repo, commit) {
    const POLL_INTERVAL = 5_000;
    while (true) {
      const res = await fetch(`${apiBase}/api/pages-status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // ココで commit フィールドを追加
        body: JSON.stringify({ owner, repo, commit })
      });
      const data = await res.json();
      // サーバー側が { ok: true, done: true } などを返してくる想定
      if (data.ok && data.done) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
});
